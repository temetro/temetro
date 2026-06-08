"use client";

import { ArrowDownIcon, ArrowUpIcon, CornerDownLeftIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import {
  Command,
  CommandCollection,
  CommandDialog,
  CommandDialogPopup,
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
} from "@/components/ui/command";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { useActiveRole, visibleNavItems } from "@/lib/roles";

type CommandPaletteContextValue = { open: () => void };

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(
  null,
);

export function useCommandPalette(): CommandPaletteContextValue {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) {
    throw new Error(
      "useCommandPalette must be used within a CommandPaletteProvider",
    );
  }
  return ctx;
}

// Holds the ⌘K palette open state, wires the global shortcut, and renders the
// dialog. Wrap the app shell so the sidebar (and any child) can open it.
export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { t } = useTranslation();
  const role = useActiveRole();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // One group ("Go to") matching the COSS command-palette particle shape.
  const groups = useMemo(
    () => [
      {
        value: "pages",
        label: t("nav.commandGroup"),
        // Flatten sub-pages so e.g. "Appointments & Schedule" is reachable.
        // Filtered by role so reception can't jump to clinical pages.
        items: visibleNavItems(role).flatMap((item) =>
          item.subs?.length
            ? item.subs.map((sub) => ({
                id: sub.id,
                label: t(sub.labelKey),
                link: sub.link,
                Icon: sub.icon ?? item.icon,
              }))
            : [
                {
                  id: item.id,
                  label: t(item.labelKey),
                  link: item.link,
                  Icon: item.icon,
                },
              ],
        ),
      },
    ],
    [t, role],
  );

  type Group = (typeof groups)[number];
  type Item = Group["items"][number];

  const value = useMemo<CommandPaletteContextValue>(
    () => ({ open: () => setOpen(true) }),
    [],
  );

  const go = (link: string) => {
    setOpen(false);
    router.push(link);
  };

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      <CommandDialog onOpenChange={setOpen} open={open}>
        <CommandDialogPopup>
          <Command items={groups}>
            <CommandInput placeholder={t("nav.commandPlaceholder")} />
            <CommandPanel>
              <CommandEmpty>{t("nav.commandEmpty")}</CommandEmpty>
              <CommandList>
                {(group: Group) => (
                  <CommandGroup items={group.items} key={group.value}>
                    <CommandGroupLabel>{group.label}</CommandGroupLabel>
                    <CommandCollection>
                      {(item: Item) => (
                        <CommandItem
                          key={item.id}
                          onClick={() => go(item.link)}
                          value={item.label}
                        >
                          <item.Icon className="size-4 text-muted-foreground" />
                          <span className="flex-1">{item.label}</span>
                        </CommandItem>
                      )}
                    </CommandCollection>
                  </CommandGroup>
                )}
              </CommandList>
            </CommandPanel>
            <CommandFooter>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-2">
                  <KbdGroup>
                    <Kbd>
                      <ArrowUpIcon />
                    </Kbd>
                    <Kbd>
                      <ArrowDownIcon />
                    </Kbd>
                  </KbdGroup>
                  {t("nav.commandNavigate")}
                </span>
                <span className="flex items-center gap-2">
                  <Kbd>
                    <CornerDownLeftIcon />
                  </Kbd>
                  {t("nav.commandOpen")}
                </span>
              </div>
              <span className="flex items-center gap-2">
                <Kbd>Esc</Kbd>
                {t("nav.commandClose")}
              </span>
            </CommandFooter>
          </Command>
        </CommandDialogPopup>
      </CommandDialog>
    </CommandPaletteContext.Provider>
  );
}
