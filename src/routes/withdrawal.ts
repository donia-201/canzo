import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { withdrawSchema } from '../validation/withdrawal'
import { approveWithdrawal, createWithdrawalRequest, getWallet, rejectWithdrawal, WalletServiceError, type WithdrawalRow } from '../services/wallet'
import { AppError } from '../middlewares/errorHandler'
import { getLanguage, label, statusLabels, walletTypeLabels, localized } from '../utils/i18n'

type TokenPayload={userId:number;user_role:string}
type Bindings={
  DB:D1Database;CLOUDINARY_CLOUD_NAME:string;
  CLOUDINARY_API_KEY:string;
  CLOUDINARY_API_SECRET:string;
  FIREBASE_PROJECT_ID:string;FIREBASE_CLIENT_EMAIL:string;
  FIREBASE_PRIVATE_KEY:string}
type Variables={jwtPayload:TokenPayload}
type WithdrawalWithClient=WithdrawalRow&{user_name:string;phone_number:string;activity_name:string;activity_type:string; screenshot_url:string|null}
type ClientWithdrawalRow=WithdrawalRow&{screenshot_url:string|null}
const ALLOWED_IMAGE_TYPES=['image/jpg','image/jpeg','image/png','image/webp']; const MAX_IMAGE_BYTES=2*1024*1024

async function sha1Hex(value:string){const data=await crypto.subtle.digest('SHA-1',new TextEncoder().encode(value));return Array.from(new Uint8Array(data)).map(b=>b.toString(16).padStart(2,'0')).join('')}
async function uploadToCloudinary(file:File,cloudName:string,apiKey:string,apiSecret:string):Promise<string>{
  if(!cloudName||!apiKey||!apiSecret) throw new AppError('CLOUDINARY_UPLOAD_FAILED','إعدادات Cloudinary غير مكتملة',500)
  const timestamp=Math.floor(Date.now()/1000).toString()
  const signature=await sha1Hex(`timestamp=${timestamp}${apiSecret}`)
  const formData=new FormData(); formData.append('file',file); formData.append('api_key',apiKey); formData.append('timestamp',timestamp); formData.append('signature',signature)
  const response=await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,{method:'POST',body:formData})
  const text=await response.text()
  if(!response.ok){ console.error('CLOUDINARY_UPLOAD_ERROR:',{status:response.status,response:text,fileName:file.name,fileType:file.type,fileSize:file.size}); throw new AppError('CLOUDINARY_UPLOAD_FAILED','فشل رفع صورة إثبات الدفع إلى Cloudinary',502) }
  let data:{secure_url?:string;public_id?:string}; try{data=JSON.parse(text)}catch{throw new AppError('CLOUDINARY_UPLOAD_FAILED','استجابة Cloudinary غير صالحة',502)}
  if(!data.secure_url) throw new AppError('CLOUDINARY_UPLOAD_FAILED','Cloudinary لم يُرجع رابط الصورة',502)
  return data.secure_url
}

function mapWalletError(c:any,err:unknown){
  if(err instanceof WalletServiceError) return c.json({success:false,error:{code:err.code,message:err.message}},err.statusCode)
  if(err instanceof AppError) return c.json({success:false,error:{code:err.code,message:err.message}},err.statusCode)
  console.error('WITHDRAWAL_ROUTE_ERROR:',err); return c.json({success:false,error:{code:'INTERNAL_SERVER_ERROR',message:localized(c,'حدث خطأ داخلي في الخادم','Internal server error')}},500)
}

export const clientWithdrawRouter=new Hono<{Bindings:Bindings;Variables:Variables}>()
clientWithdrawRouter.post('/withdraw',zValidator('json',withdrawSchema,(result,c)=>{if(!result.success)return c.json({success:false,error:{code:'VALIDATION_ERROR',message:result.error.issues[0].message}},400)}),async c=>{
  try{const {userId}=c.get('jwtPayload') as TokenPayload; const {amount,wallet_number,wallet_type}=c.req.valid('json'); const withdrawalId=await createWithdrawalRequest(c.env.DB,userId,amount,wallet_number,wallet_type); const wallet=await getWallet(c.env.DB,userId); return c.json({message:localized(c,'تم طلب عملية السحب بنجاح','Withdrawal request created successfully'),withdrawalId,wallet:{balance:wallet.balance,pending_balance:wallet.pending_balance,total:wallet.balance+wallet.pending_balance}},201)}catch(e){return mapWalletError(c,e)}})
.get('/withdrawals',async c=>{try{const {userId}=c.get('jwtPayload') as TokenPayload; const lang=getLanguage(c); const rows=await c.env.DB.prepare('SELECT id,user_id,amount,status,admin_id,screenshot_path,screenshot_path AS screenshot_url,wallet_number,wallet_type,created_at,updated_at FROM withdrawal_requests WHERE user_id=?1 ORDER BY created_at DESC').bind(userId).all<ClientWithdrawalRow>(); const withdrawals=rows.results.map(w=>({...w,status_label:label(statusLabels,w.status,lang),wallet_type_label:label(walletTypeLabels,w.wallet_type,lang)})); const wallet=await getWallet(c.env.DB,userId); return c.json({withdrawals,wallet:{balance:wallet.balance,pending_balance:wallet.pending_balance,total:wallet.balance+wallet.pending_balance}})}catch(e){return mapWalletError(c,e)}})

export const adminWithdrawRouter=new Hono<{Bindings:Bindings;Variables:Variables}>()
adminWithdrawRouter.get('/withdrawals',async c=>{try{const status=c.req.query('status'); if(status&&!['Pending','Approved','Rejected'].includes(status))return c.json({success:false,error:{code:'VALIDATION_ERROR',message:localized(c,'حالة الطلب غير صحيحة','Invalid withdrawal status')}},400); const lang=getLanguage(c); const base=`SELECT wr.id,wr.user_id,wr.amount,wr.status,wr.admin_id,wr.screenshot_path,wr.screenshot_path AS screenshot_url,wr.wallet_number,wr.wallet_type,wr.created_at,wr.updated_at,u.user_name,u.phone_number,COALESCE(cl.activity_name,'') AS activity_name,COALESCE(cl.activity_type,'') AS activity_type FROM withdrawal_requests wr JOIN users u ON wr.user_id=u.id LEFT JOIN clients cl ON cl.user_id=u.id`; const q=status?`${base} WHERE wr.status=?1 ORDER BY wr.created_at DESC`:`${base} ORDER BY wr.created_at DESC`; const rows=status?await c.env.DB.prepare(q).bind(status).all<WithdrawalWithClient>():await c.env.DB.prepare(q).all<WithdrawalWithClient>(); const withdrawals=rows.results.map(w=>({...w,status_label:label(statusLabels,w.status,lang),wallet_type_label:label(walletTypeLabels,w.wallet_type,lang)})); return c.json({withdrawals},200)}catch(e){return mapWalletError(c,e)}})
.patch('/withdraw/:id',async c=>{try{const {userId:adminId}=c.get('jwtPayload') as TokenPayload; const id=Number(c.req.param('id')); if(!Number.isInteger(id)||id<=0)return c.json({success:false,error:{code:'VALIDATION_ERROR',message:localized(c,'معرّف طلب السحب غير صالح','Invalid withdrawal id')}},400); const body=await c.req.parseBody(); const status=String(body.status||''); const image=body.screenshot; if(status!=='Approved'&&status!=='Rejected')return c.json({success:false,error:{code:'VALIDATION_ERROR',message:localized(c,'حالة الطلب غير صالحة','Invalid withdrawal status')}},400)
  if(status==='Approved'){
    if(!(image instanceof File)||image.size===0)return c.json({success:false,error:{code:'VALIDATION_ERROR',message:localized(c,'صورة إثبات الدفع مطلوبة عند الموافقة على طلب السحب. استخدم field باسم screenshot.','Payment screenshot is required when approving a withdrawal. Use a multipart field named screenshot.')}},400)
    if(image.size>MAX_IMAGE_BYTES)return c.json({success:false,error:{code:'VALIDATION_ERROR',message:localized(c,'حجم الصورة أكبر من 2 ميجابايت','Image size must not exceed 2 MB')}},400)
    const type=image.type.toLowerCase().trim(); const name=image.name.toLowerCase(); const valid=ALLOWED_IMAGE_TYPES.includes(type)||['.png','.jpg','.jpeg','.webp'].some(ext=>name.endsWith(ext)); if(!valid)return c.json({success:false,error:{code:'VALIDATION_ERROR',message:localized(c,'نوع الصورة غير صالح. المسموح: png, jpg, jpeg, webp','Invalid image type. Allowed: png, jpg, jpeg, webp')}},400)
    const imageUrl=await uploadToCloudinary(image,c.env.CLOUDINARY_CLOUD_NAME,c.env.CLOUDINARY_API_KEY,c.env.CLOUDINARY_API_SECRET)
    await approveWithdrawal(c.env.DB,id,adminId,imageUrl,{FIREBASE_PROJECT_ID:c.env.FIREBASE_PROJECT_ID,FIREBASE_CLIENT_EMAIL:c.env.FIREBASE_CLIENT_EMAIL,FIREBASE_PRIVATE_KEY:c.env.FIREBASE_PRIVATE_KEY})
    return c.json({message:localized(c,'تمت الموافقة على عملية السحب','Withdrawal approved successfully'),screenshot_url:imageUrl,screenshot_path:imageUrl},200)
  }
  await rejectWithdrawal(c.env.DB,id,adminId,{FIREBASE_PROJECT_ID:c.env.FIREBASE_PROJECT_ID,FIREBASE_CLIENT_EMAIL:c.env.FIREBASE_CLIENT_EMAIL,FIREBASE_PRIVATE_KEY:c.env.FIREBASE_PRIVATE_KEY}); return c.json({message:localized(c,'تم رفض عملية السحب','Withdrawal rejected successfully')},200)
}catch(e){return mapWalletError(c,e)}})
