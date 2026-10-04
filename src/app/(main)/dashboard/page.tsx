import { WikiHome } from "./_components/wiki-home";

// Счётчики на главной берутся из базы, поэтому страница не должна собираться заранее.
export const dynamic = "force-dynamic";

export default function Page() {
  return <WikiHome />;
}
