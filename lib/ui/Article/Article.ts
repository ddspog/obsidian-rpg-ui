import { ArticleColumn } from "./ArticleColumn";
import type { ArticleColumnProps } from "./ArticleColumn";

export const Article = {
  Column: ArticleColumn,
} as const;

export namespace Article {
  export type ColumnProps = ArticleColumnProps;
}

export type ArticleType = typeof Article;

export default Article;
