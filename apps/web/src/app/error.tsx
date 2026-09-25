'use client';
import{ErrorState}from'@/components/ui';export default function ErrorPage({reset}:{reset:()=>void}){return <section className="section"><ErrorState/><button className="button" onClick={reset}>Try again</button></section>;}
