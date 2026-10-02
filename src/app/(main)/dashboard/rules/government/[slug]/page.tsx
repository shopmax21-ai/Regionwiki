import { notFound } from "next/navigation";

import { RuleArticleViewer } from "../../_components/rule-article";
import { getArticle, getGroupSlugs } from "../../_components/rules-content";

export const dynamicParams = false;

export function generateStaticParams() {
  return getGroupSlugs("government").map((slug) => ({ slug }));
}

export default async function GovernmentRuleArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getArticle("government", slug);
  if (!article) notFound();
  return <RuleArticleViewer article={article} />;
}
