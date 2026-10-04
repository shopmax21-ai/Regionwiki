import type { Job, JobEditorState } from "../_data/jobs";
import { JobArticleEditable } from "./job-article-editable";
import { JobArticleView } from "./job-article-view";

export { JobArticleView };

type JobArticleProps = { job: Job; jobs: Job[]; editor: JobEditorState };

export function JobArticle({ job, jobs, editor }: JobArticleProps) {
  // Редактор нужен только тем, у кого есть право; остальные получают обычную страницу
  if (editor === "on") return <JobArticleEditable job={job} jobs={jobs} />;
  return <JobArticleView job={job} jobs={jobs} />;
}
