"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { type CallPeer, MAX_CALL_PEERS } from "@/lib/meetings";
import { getSocket } from "@/lib/socket";

// Public STUN keeps this dependency-free for clinics on the same network or with
// simple NATs. Cross-network/symmetric-NAT calls would also need a TURN server —
// a deployment add-on, out of scope for the mesh MVP.
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
];

export type RemotePeer = {
  socketId: string;
  userName: string;
  stream: MediaStream | null;
};

export type JoinState = "idle" | "joining" | "joined" | "full" | "error";

type Signal = {
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
};

// A peer-to-peer mesh call over the shared Socket.io connection: each participant
// holds one RTCPeerConnection per other participant. The newcomer initiates
// offers to everyone already in the room; existing peers answer. Media never
// touches the server — it only relays SDP/ICE.
export function useWebRtcMesh(roomId: string | null) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<RemotePeer[]>([]);
  const [joinState, setJoinState] = useState<JoinState>("idle");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [screenOn, setScreenOn] = useState(false);

  const pcsRef = useRef(new Map<string, RTCPeerConnection>());
  const localStreamRef = useRef<MediaStream | null>(null);
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  const upsertPeer = useCallback((peer: Partial<RemotePeer> & { socketId: string }) => {
    setPeers((prev) => {
      const existing = prev.find((p) => p.socketId === peer.socketId);
      if (existing) {
        return prev.map((p) =>
          p.socketId === peer.socketId ? { ...p, ...peer } : p,
        );
      }
      return [
        ...prev,
        { socketId: peer.socketId, userName: peer.userName ?? "", stream: peer.stream ?? null },
      ];
    });
  }, []);

  const removePeer = useCallback((socketId: string) => {
    pcsRef.current.get(socketId)?.close();
    pcsRef.current.delete(socketId);
    setPeers((prev) => prev.filter((p) => p.socketId !== socketId));
  }, []);

  useEffect(() => {
    if (!roomId) return;
    const socket = getSocket();
    const pcs = pcsRef.current;
    let cancelled = false;

    const createPc = (peerId: string, userName: string): RTCPeerConnection => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      for (const track of localStreamRef.current?.getTracks() ?? []) {
        pc.addTrack(track, localStreamRef.current!);
      }
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socket.emit("call:signal", {
            to: peerId,
            signal: { candidate: e.candidate.toJSON() },
          });
        }
      };
      pc.ontrack = (e) => {
        upsertPeer({ socketId: peerId, userName, stream: e.streams[0] ?? null });
      };
      pcs.set(peerId, pc);
      upsertPeer({ socketId: peerId, userName });
      return pc;
    };

    const onPeerJoined = (peer: CallPeer) => {
      // The newcomer offers to us; just record their name for now.
      upsertPeer({ socketId: peer.socketId, userName: peer.userName });
    };

    const onSignal = async ({ from, signal }: { from: string; signal: Signal }) => {
      let pc = pcs.get(from);
      try {
        if (signal.sdp) {
          if (!pc) pc = createPc(from, "");
          await pc.setRemoteDescription(signal.sdp);
          if (signal.sdp.type === "offer") {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit("call:signal", { to: from, signal: { sdp: answer } });
          }
        } else if (signal.candidate && pc) {
          await pc.addIceCandidate(signal.candidate).catch(() => {});
        }
      } catch {
        /* a failed negotiation drops just this peer link */
      }
    };

    const onPeerLeft = ({ socketId }: { socketId: string }) => removePeer(socketId);

    const start = async () => {
      setJoinState("joining");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
        });
        if (cancelled) {
          for (const t of stream.getTracks()) t.stop();
          return;
        }
        localStreamRef.current = stream;
        cameraTrackRef.current = stream.getVideoTracks()[0] ?? null;
        setLocalStream(stream);

        socket.on("call:peer-joined", onPeerJoined);
        socket.on("call:signal", onSignal);
        socket.on("call:peer-left", onPeerLeft);

        socket.emit(
          "call:join",
          roomId,
          (res: { ok: boolean; reason?: string; peers?: CallPeer[] }) => {
            if (cancelled) return;
            if (!res?.ok) {
              setJoinState(res?.reason === "full" ? "full" : "error");
              return;
            }
            setJoinState("joined");
            // We're the newcomer: initiate an offer to each existing peer.
            for (const peer of res.peers ?? []) {
              const pc = createPc(peer.socketId, peer.userName);
              pc.createOffer()
                .then((offer) => pc.setLocalDescription(offer).then(() => offer))
                .then((offer) =>
                  socket.emit("call:signal", {
                    to: peer.socketId,
                    signal: { sdp: offer },
                  }),
                )
                .catch(() => {});
            }
          },
        );
      } catch {
        if (!cancelled) setJoinState("error");
      }
    };

    void start();

    return () => {
      cancelled = true;
      socket.emit("call:leave", roomId);
      socket.off("call:peer-joined", onPeerJoined);
      socket.off("call:signal", onSignal);
      socket.off("call:peer-left", onPeerLeft);
      for (const pc of pcs.values()) pc.close();
      pcs.clear();
      for (const t of localStreamRef.current?.getTracks() ?? []) t.stop();
      for (const t of screenStreamRef.current?.getTracks() ?? []) t.stop();
      localStreamRef.current = null;
      screenStreamRef.current = null;
      setPeers([]);
      setLocalStream(null);
      setJoinState("idle");
    };
  }, [roomId, upsertPeer, removePeer]);

  const toggleMic = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
  }, []);

  const toggleCam = useCallback(() => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCamOn(track.enabled);
  }, []);

  // Swap the outgoing video track on every peer connection between camera and
  // screen share via sender.replaceTrack (no renegotiation needed).
  const replaceVideoTrack = useCallback((track: MediaStreamTrack) => {
    for (const pc of pcsRef.current.values()) {
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      void sender?.replaceTrack(track);
    }
  }, []);

  const toggleScreen = useCallback(async () => {
    if (screenOn) {
      const cam = cameraTrackRef.current;
      if (cam) replaceVideoTrack(cam);
      for (const t of screenStreamRef.current?.getTracks() ?? []) t.stop();
      screenStreamRef.current = null;
      setScreenOn(false);
      return;
    }
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = display.getVideoTracks()[0];
      if (!screenTrack) return;
      screenStreamRef.current = display;
      replaceVideoTrack(screenTrack);
      setScreenOn(true);
      // Revert to camera when the user stops sharing from the browser UI.
      screenTrack.onended = () => {
        const cam = cameraTrackRef.current;
        if (cam) replaceVideoTrack(cam);
        screenStreamRef.current = null;
        setScreenOn(false);
      };
    } catch {
      /* user dismissed the picker */
    }
  }, [screenOn, replaceVideoTrack]);

  return {
    localStream,
    peers,
    joinState,
    micOn,
    camOn,
    screenOn,
    toggleMic,
    toggleCam,
    toggleScreen,
    maxPeers: MAX_CALL_PEERS,
  };
}
