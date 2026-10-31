import "dotenv/config"
import connectDB from "./db/index.js"
import { app } from "./app.js"

connectDB()
.then(()=>{
    app.listen(process.env.PORT || 8000,()=>{{
        console.log("Server is running");
    }})
    app.on("error",(err)=>{
        console.log("error",err);
        throw err;
    })
})
.catch((err)=>{
    console.log("MongoDb connecion failed ",err);
})