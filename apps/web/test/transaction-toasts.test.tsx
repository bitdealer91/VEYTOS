import {expect,test} from 'vitest';
import {fireEvent,render,screen} from '@testing-library/react';
import {TransactionToastProvider,useTransactionToast} from '../src/components/transaction-toasts';

function Harness(){const toast=useTransactionToast();return <><button onClick={()=>toast.show({id:'trade',title:'Confirm in wallet',message:'Review the transaction.',tone:'pending'})}>Pending</button><button onClick={()=>toast.show({id:'trade',title:'NFT listed',message:'Listing is active on Aptos.',tone:'success',href:'https://explorer.aptoslabs.com/txn/0x1'})}>Success</button></>;}

test('one transaction toast updates through its lifecycle and links to Explorer',()=>{render(<TransactionToastProvider><Harness/></TransactionToastProvider>);fireEvent.click(screen.getByRole('button',{name:'Pending'}));expect(screen.getByRole('status')).toHaveProperty('textContent',expect.stringContaining('Confirm in wallet'));fireEvent.click(screen.getByRole('button',{name:'Success'}));expect(screen.getAllByRole('status')).toHaveLength(1);expect(screen.getByRole('status')).toHaveProperty('textContent',expect.stringContaining('NFT listed'));expect((screen.getByRole('link',{name:/View transaction/}) as HTMLAnchorElement).target).toBe('_blank');fireEvent.click(screen.getByRole('button',{name:'Dismiss notification'}));expect(screen.queryByRole('status')).toBe(null);});
