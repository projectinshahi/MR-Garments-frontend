import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { currencyFixture as CURRENCIES } from "@/features/settings/data/fixtures";

import { CurrencyCombobox } from "./currency-combobox";

// The searchable currency picker: found by code, name or symbol; arrow keys and Enter pick; nothing matching says so.

function Harness({ onChange, initial = "CNY", currencies = CURRENCIES }: { onChange?: (code: string) => void; initial?: string; currencies?: typeof CURRENCIES }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <label htmlFor="currency">Preferred transaction currency</label>
      <CurrencyCombobox
        id="currency"
        value={value}
        currencies={currencies}
        onChange={(code) => {
          setValue(code);
          onChange?.(code);
        }}
      />
    </>
  );
}

async function open(props: Parameters<typeof Harness>[0] = {}) {
  const user = userEvent.setup();
  render(<Harness {...props} />);
  const trigger = screen.getByRole("combobox", { name: "Preferred transaction currency" });
  await user.click(trigger);
  const search = screen.getByRole("searchbox", { name: "Search currencies" });
  const options = () => within(screen.getByRole("listbox", { name: "Currencies" })).getAllByRole("option").map((option) => option.getAttribute("aria-label"));
  return { user, trigger, search, options };
}

describe("CurrencyCombobox", () => {
  it("shows the chosen currency as code, name and symbol, and opens with the search focused and the preferred currencies first", async () => {
    const { trigger, search, options } = await open();
    expect(trigger).toHaveTextContent("CNY – Chinese Yuan (¥)");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(search).toHaveFocus();
    expect(options()).toEqual(["CNY – Chinese Yuan (¥)", "USD – US Dollar ($)", "INR – Indian Rupee (₹)", "AED – United Arab Emirates Dirham (AED)", "EUR – Euro (€)", "GBP – British Pound (£)", "JPY – Japanese Yen (JPY)"]);
    expect(screen.getByRole("option", { name: /^CNY/ })).toHaveAttribute("aria-selected", "true");
  });

  it("filters by name, by code and by symbol, and a click picks", async () => {
    const onChange = vi.fn();
    const { user, trigger, search, options } = await open({ onChange });
    await user.type(search, "dirham");
    expect(options()).toEqual(["AED – United Arab Emirates Dirham (AED)"]);
    // ISO's names are searched too: "UAE Dirham", "Yuan Renminbi", "Pound Sterling".
    await user.clear(search);
    await user.type(search, "UAE");
    expect(options()).toEqual(["AED – United Arab Emirates Dirham (AED)"]);
    await user.clear(search);
    await user.type(search, "renminbi");
    expect(options()).toEqual(["CNY – Chinese Yuan (¥)"]);
    await user.clear(search);
    await user.type(search, "sterling");
    expect(options()).toEqual(["GBP – British Pound (£)"]);
    await user.clear(search);
    await user.type(search, "jpy");
    expect(options()).toEqual(["JPY – Japanese Yen (JPY)"]);
    await user.clear(search);
    await user.type(search, "€");
    expect(options()).toEqual(["EUR – Euro (€)"]);
    await user.click(screen.getByRole("option", { name: /^EUR/ }));
    expect(onChange).toHaveBeenCalledWith("EUR");
    expect(trigger).toHaveTextContent("EUR – Euro (€)");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("moves with the arrow keys and picks with Enter; Escape closes without picking", async () => {
    const onChange = vi.fn();
    const { user, trigger, search } = await open({ onChange, initial: "USD" });
    // Opens on the current value (USD, second row); down twice lands on AED.
    expect(search).toHaveAttribute("aria-activedescendant", expect.stringContaining("USD"));
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(search).toHaveAttribute("aria-activedescendant", expect.stringContaining("AED"));
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("AED");
    expect(trigger).toHaveTextContent("AED – United Arab Emirates Dirham (AED)");

    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("says when nothing matches, and when the list could not be loaded", async () => {
    const { user, search } = await open();
    await user.type(search, "rupiah");
    expect(screen.getByRole("status")).toHaveTextContent("No currency matches “rupiah”.");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    await user.keyboard("{Enter}"); // nothing to pick
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("tells the user when the master did not load", async () => {
    const { trigger } = await open({ currencies: [] });
    expect(screen.getByRole("status")).toHaveTextContent("The currency list could not be loaded.");
    // The saved currency still shows, so an edit can be saved without touching it.
    expect(trigger).toHaveTextContent("CNY (¥)");
  });
});
