import { Hono } from "hono";
import { localizedError } from "../utils/i18n";


type Bindings = {
CLOUDINARY_CLOUD_NAME: string;
}
const imageRouter = new Hono<{Bindings:Bindings}>()
imageRouter.get("/image/:key",async(c)=>{
    try{
const key = c.req.param("key")
if (!key || key.includes("..") || !/^[\w\-\.\/]+$/.test(key)) {
  return c.json({success:false,error:{code:"INVALID_KEY",message:localizedError(c,"INVALID_KEY")}}, 400)
}

if (key.startsWith('http://') || key.startsWith('https://')) {
      return c.redirect(key, 302)
    }
const cloudName = c.env.CLOUDINARY_CLOUD_NAME || "wlslnvd1";

const cloudinaryUrl = `https://res.cloudinary.com/${cloudName}/image/upload/${key}`;

return c.redirect(cloudinaryUrl, 302);
  } catch (error) {
    console.error(`error while getting image ${error}`);
        throw error
  }
})
export default imageRouter