"use client";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  CornerDownLeftIcon,
  Search,
} from "lucide-react";
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
import { useSidebar } from "@/components/ui/sidebar";
import { navItems } from "@/lib/nav";

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
        items: navItems.map((item) => ({
          id: item.id,
          label: t(item.labelKey),
          link: item.link,
          Icon: item.icon,
        })),
      },
    ],
    [t],
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

// Sidebar-footer affordance: shows the ⌘K hint and opens the palette on click.
// Hidden when the sidebar is collapsed to its icon rail.
export function SidebarCommandButton() {
  const { open } = useCommandPalette();
  const { state } = useSidebar();
  const { t } = useTranslation();

  if (state === "collapsed") return null;

  return (
    <button
      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-muted-foreground text-sm transition-colors hover:bg-sidebar-muted hover:text-foreground"
      onClick={open}
      type="button"
    >
      <Search className="size-4" />
      <span>{t("nav.quickNav")}</span>
      <KbdGroup className="ml-auto">
        <Kbd>⌘</Kbd>
        <Kbd>K</Kbd>
      </KbdGroup>
    </button>
  );
}
