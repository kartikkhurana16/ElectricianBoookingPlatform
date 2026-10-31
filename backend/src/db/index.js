import mongoose from "mongoose"
import {DB_NAME} from "../constants.js"

const connectDB=async()=>{
    try {
        const connectionInstance = await mongoose.connect(
            `${process.env.MONGODB_URI}`
        );
        console.log("MongoDB connected", connectionInstance.connection.host);
        console.log("Database :",DB_NAME);
        
    } catch (error) {
        console.log("MongoDB Connection Failed : ",error);
        process.exit(1);
    }    
}

export default connectDB;