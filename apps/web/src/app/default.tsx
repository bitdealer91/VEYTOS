// The root `children` prop is an implicit parallel-route slot because the
// layout also renders `@modal`. Next.js requires an explicit fallback for URLs
// handled only by Route Handlers, such as `/api/*`.
export default function Default() {
  return null;
}
