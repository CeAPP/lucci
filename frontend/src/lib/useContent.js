import { useEffect, useState, useCallback } from "react";
import api from "@/lib/api";

/**
 * useContent(page)
 *
 * Loads the CMS content blocks for a given page and returns:
 *   - t(key, fallback): returns block value or the fallback
 *   - blocks: the raw map (for debugging)
 *
 * Values are stored in the `content_blocks` MongoDB collection and edited via Admin > Site.
 */
export default function useContent(page) {
  const [blocks, setBlocks] = useState({});
  useEffect(() => {
    let mounted = true;
    api.get("/content", { params: { page } })
      .then((r) => { if (mounted) setBlocks((r.data && r.data[page]) || {}); })
      .catch(() => {});
    return () => { mounted = false; };
  }, [page]);
  const t = useCallback((key, fallback = "") => {
    const v = blocks[key];
    return (v === undefined || v === null || v === "") ? fallback : v;
  }, [blocks]);
  return { t, blocks };
}
