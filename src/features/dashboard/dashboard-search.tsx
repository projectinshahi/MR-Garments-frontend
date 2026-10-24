"use client";

import { useState } from "react";

import { SearchInput } from "@/components/shared/filters";
import { notInPrototype } from "@/components/shared/prototype";

/**
 * Header search. There is no results view in the references, so Enter submits to notInPrototype (D5).
 * Undesigned narrow widths: the date pill keeps priority in the header, so the search is hidden below 640 px and
 * narrower until 1024 px, where the sidebar leaves less room. 250 px from 1024 px, as in the reference.
 */
export function DashboardSearch() {
  const [query, setQuery] = useState("");
  return (
    <form
      role="search"
      className="hidden sm:block"
      onSubmit={(event) => {
        event.preventDefault();
        notInPrototype("Search");
      }}
    >
      <SearchInput
        size="sm"
        label="Search PO, supplier, container"
        placeholder="Search PO, supplier, container"
        value={query}
        onValueChange={setQuery}
        className="w-[170px] lg:w-[250px]"
      />
    </form>
  );
}
