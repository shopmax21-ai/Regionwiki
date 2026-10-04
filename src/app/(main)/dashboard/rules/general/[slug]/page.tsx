import { notFound } from "next/navigation";

import { RuleArticleViewer } from "../../_components/rule-article";
import { getArticle, getGroupSlugs } from "../../_components/rules-content";

export const dynamic = "force-dynamic";
export const dynamicParams = false;

export function generateStaticParams() {
  return getGroupSlugs("general").map((slug) => ({ slug }));
}

export default async function GeneralRuleArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getArticle("general", slug);
  if (!article) notFound();
  return <RuleArticleViewer article={article} />;
}
