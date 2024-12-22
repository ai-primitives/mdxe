declare module 'remark-mdxld' {
  import { Plugin } from 'unified';
  
  interface RemarkMdxldOptions {
    context?: string;
    type?: string;
  }

  const remarkMdxld: Plugin<[RemarkMdxldOptions?]>;
  export default remarkMdxld;
}
