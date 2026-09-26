import { NextResponse } from 'next/server';
import { z } from 'zod';
const payload=z.object({category:z.enum(['rpc_rate_limit','rpc_unavailable','indexer_failure','metadata_failure','wallet_adapter','move_abort','transaction_submission','reconciliation_failure','unknown']),context:z.string().max(64),path:z.string().max(256)});
export async function POST(request:Request){const parsed=payload.safeParse(await request.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:'Invalid report'},{status:400});console.error(JSON.stringify({kind:'client_error',...parsed.data,at:new Date().toISOString()}));return new NextResponse(null,{status:204});}
