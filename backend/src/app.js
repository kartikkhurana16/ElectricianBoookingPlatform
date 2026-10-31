import cors from "cors"
import express from "express"
import cookieParser from "cookie-parser"

const app=express();

app.use(cors({
    origin:process.env.CORS_ORIGIN,
    credentials:true
}))
app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(express.static("public"));
app.use(cookieParser());

app.get("/",(req,res)=>{
    res.send(`server is running on port : ${process.env.PORT}`);
})
import userRouter from "./routes/user.route.js"
app.use("/api/v1/users", userRouter);  // http://localhost:8000/api/v1/users/register

app.use((err,req,res,next)=>{
    const statusCode=err.statusCode || 500;
    return res.status(statusCode).json({
        statusCode,
        success:false,
        message:err.message || "Internal Server Error",
        error:err.error || []
    })
})


export {app}