import { notFound } from "next/navigation";

// A URL no page matches (an old bookmark such as /warehouse/receive, or /orders/<po>/<unknown tab>) shows the app's
// not-found page inside the shell, instead of Next's bare 404 with no way back.
export default function MissingPage() {
  notFound();
}
