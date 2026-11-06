import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { CHARACTERS, type Character } from "../game/data";
import { findOwned, getMeta, lastRpcError, randomSqueeks } from "./reader";
import { lookFromMeta, type SqueekMeta } from "./squeeks";

export type RosterStatus = "idle" | "loading" | "ready" | "error";

export interface Roster {
  mine: Character[];
  guests: Character[];
  rivals: Character[];
  mineStatus: RosterStatus;
  mineError: string;
  poolStatus: RosterStatus;
  address: string | undefined;
  find: (id: string) => Character | undefined;
  refresh: () => void;
}

export function racerFromMeta(meta: SqueekMeta, source: Character["source"]): Character {
  const look = lookFromMeta(meta);
  return {
    id: `sq-${meta.id}`,
    name: `Squeek #${meta.id}`,
    blurb: meta.name,
    ...look,
    cost: 0,
    tokenId: meta.id,
    image: meta.image,
    source,
    traits: meta.attributes,
  };
}

// The same guests for everyone on a given day, so friends can talk about "today's" Squeeks.
const daySeed = () => Math.floor(Date.now() / 86_400_000) * 2654435761;

// Offline: the classic hamsters stand in so the game always works.
const CLASSICS: Character[] = CHARACTERS.map((c) => ({ ...c, source: "classic" as const }));

export function useRoster(): Roster {
  const { address, isConnected } = useAccount();
  const [mine, setMine] = useState<Character[]>([]);
  const [mineStatus, setMineStatus] = useState<RosterStatus>("idle");
  const [mineError, setMineError] = useState("");
  const [pool, setPool] = useState<Character[]>([]);
  const [poolStatus, setPoolStatus] = useState<RosterStatus>("loading");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    setPoolStatus("loading");
    randomSqueeks(12, daySeed())
      .then((metas) => {
        if (!live) return;
        setPool(metas.map((m) => racerFromMeta(m, "guest")));
        setPoolStatus(metas.length ? "ready" : "error");
      })
      .catch(() => live && setPoolStatus("error"));
    return () => {
      live = false;
    };
  }, [tick]);

  useEffect(() => {
    if (!isConnected || !address) {
      setMine([]);
      setMineStatus("idle");
      return;
    }
    let live = true;
    setMineStatus("loading");
    setMineError("");
    findOwned(address)
      .then(async (own) => {
        const ids = [...own.wallet, ...own.staked];
        const metas = await getMeta(ids);
        if (!live) return;
        setMine(
          ids
            .map((id) => metas.get(id))
            .filter((m): m is SqueekMeta => !!m)
            .map((m) => racerFromMeta(m, own.staked.includes(m.id) ? "staked" : "wallet")),
        );
        setMineStatus("ready");
      })
      .catch((e) => {
        if (!live) return;
        console.warn("[squeek] could not read wallet Squeeks", e);
        setMineError(lastRpcError || (e instanceof Error ? e.message : String(e)));
        setMineStatus("error");
      });
    return () => {
      live = false;
    };
  }, [address, isConnected, tick]);

  return useMemo(() => {
    const guests = poolStatus === "error" && !pool.length ? CLASSICS : pool.slice(0, 6);
    const rivals = pool.length >= 11 ? pool.slice(6) : CLASSICS;
    const all = [...mine, ...guests, ...rivals, ...CLASSICS];
    return {
      mine,
      guests,
      rivals,
      mineStatus,
      mineError,
      poolStatus,
      address,
      find: (id: string) => all.find((c) => c.id === id),
      refresh: () => setTick((t) => t + 1),
    };
  }, [mine, pool, mineStatus, mineError, poolStatus, address]);
}
