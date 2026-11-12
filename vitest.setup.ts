import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(cleanup);

// jsdom has no layout, so no scrollIntoView (the currency picker keeps its active row in view with it).
if (typeof Element !== "undefined") Element.prototype.scrollIntoView ??= () => {};
