import { User } from "../model/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import cookieParser from "cookie-parser";
import asyncHandler from "../utils/asyncHandler.js"
import { Verification } from "../model/OTP_verification.model.js";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { sendEmail } from "../utils/sendEmail.js";
const VERIFICATION_CODE_EXPIRY_MS=10*60*1000 // 10 min
const MAX_VERIFICATION_ATTEMPTS=5

const hashCode=(code)=>crypto.createHash("sha256").update(code).digest("hex")

const isCodeMatch=(code,storedHash)=>{
    const a=Buffer.from(hashCode(code),"hex");
    const b=Buffer.from(storedHash,"hex");
    return a.length===b.length && crypto.timingSafeEqual(a,b);
}

const generateAccessAndRefereshToken=async(userId)=>{
    try {
        const user=await User.findById(userId);
        const accessToken=user.generateAccessToken();
        const refreshToken=user.generateRefreshToken();
    
        user.refreshToken=refreshToken;
    
        await user.save({validateBeforeSave:false})
    
        return {accessToken,refreshToken};
    } catch (error) {
        throw new ApiError(500,"Something went wrong in token creation")
    }
}

const userRegister = asyncHandler(async (req, res) => {

    const { fullName, email, phoneNumber, password } = req.body;

    if (!fullName || !phoneNumber || !password) {
        throw new ApiError(400, "All required fields must be provided");
    }

    const normalizedEmail = email?.trim().toLowerCase();

    const existingUser = await User.findOne({
        $or: [
            { phoneNumber },
            ...(normalizedEmail ? [{ email: normalizedEmail }] : [])
        ]
    });

    if (existingUser) {
        throw new ApiError(
            409,
            "User with this email or phone number already exists"
        );
    }

    const user = await User.create({
        fullName,
        email: normalizedEmail,
        phoneNumber,
        password,
        role: "customer"
    });

    const registeredUser = await User.findById(user._id)
        .select("-password -refreshToken");

    return res.status(201).json(
        new ApiResponse(
            201,
            registeredUser,
            "User registered successfully"
        )
    );
});

const userLogin=asyncHandler(async(req,res)=>{
    const {userId,password}=req.body;
    if(!(userId && password)){
        throw new ApiError(400,"all the credential are required")
    }
    const loginId=userId.trim();
    const user= await User.findOne({
        $or:[
            {email:loginId?.toLowerCase()},
            {phoneNumber:loginId}
        ]
    }).select("+password")
    if(!user){
        throw new ApiError(404,"User does not exist")
    }
    const isPasswordValid=await user.isPasswordCorrect(password)

    if(!isPasswordValid){
        throw new ApiError(401,"Invalid Credentials")
    }
    const {accessToken,refreshToken}=await generateAccessAndRefereshToken(user._id);

    const loggedInUser=await User.findById(user._id).select("-password -refreshToken")

    const options={
        httpOnly:true,
        secure:true
    }

    return res.status(200)
                .cookie("accessToken",accessToken,options)
                .cookie("refreshToken",refreshToken,options)
                .json(new ApiResponse(200,
                    {
                        user:loggedInUser
                    },
                    "user logined in successfully"
                ))
})

const userLogout=asyncHandler(async(req,res)=>{
    await User.findByIdAndUpdate(req.user._id,
        {
            $unset:{
                refreshToken:1
            }
        }
    )

    const option={
        httpOnly:true,
        secure:true
    }

    return res.status(200)
            .clearCookie("accessToken",option)
            .clearCookie("refreshToken",option)
            .json(new ApiResponse(200,{},"User logged out successfully"))
})

const changeUserPassword=asyncHandler(async(req,res)=>{
    const {newPassword,oldPassword}=req.body;
    if(!(newPassword && oldPassword)){
        throw new ApiError(400,"enter the credential for update the password")
    }

    const user = await User.findById(req.user._id).select("+password");

    const isPasswordCorrect=await user.isPasswordCorrect(oldPassword);

    if(!isPasswordCorrect){
        throw new ApiError(400,"invalid old password")
    }
    user.password=newPassword;
    await user.save({validateBeforeSave:false})

    return res.status(200)
            .json(new ApiResponse(200,{},"password updated successfully"))
})

const refreshTokenAccess = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken
    if (!incomingRefreshToken) {
        throw new ApiError(401, "unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)

        const user = await User.findById(decodedToken?._id);
        if (!user) {
            throw new ApiError(401, "invalid refresh token")
        }
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used")
        }

        const options = {
            httpOnly: true,
            secure: true
        }

        const { accessToken, refreshToken: newRefreshToken } = await generateAccessAndRefereshToken(user._id)

        return res.status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(new ApiResponse(200, { accessToken, refreshToken: newRefreshToken }, "access token refreshed"));
    } catch (error) {
        throw new ApiError(401, error?.message || "invalid refresh token");
    }
})

const getCurrentUser=asyncHandler(async(req,res)=>{
    return res
    .status(200)
    .json(new ApiResponse(200 ,req.user,"current user fetched succesfully"))
})

const forgotPassword = asyncHandler(async (req, res) => {

    const { email } = req.body;

    if (!email || email.trim() === "") {
        throw new ApiError(400, "Email is required");
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail });

    const response = new ApiResponse(
        200,
        {},
        "If an account exists for this email, a verification code has been sent"
    );

    // Don't reveal whether the account exists
    if (!user) {
        return res.status(200).json(response);
    }

    const code = crypto.randomInt(100000, 1000000).toString();

    await Verification.findOneAndUpdate(
        {
            identifier: normalizedEmail,
            type: "email"
        },
        {
            verificationCode: hashCode(code),
            verificationCodeExpiry: new Date(
                Date.now() + VERIFICATION_CODE_EXPIRY_MS
            ),
            attempts: 0,
            isVerified: false
        },
        {
            upsert: true,
            new: true,
            runValidators: true,
            setDefaultsOnInsert: true
        }
    );

    try {
        await sendEmail({
            to: user.email,
            subject: "Password Reset Verification Code",
            text: `Your verification code is ${code}. It expires in 10 minutes.`,
            html: `
                <h2>Password Reset</h2>
                <p>Your verification code is <b>${code}</b></p>
                <p>This code expires in 10 minutes.</p>
            `
        });
    } catch (error) {
        await Verification.deleteOne({
            identifier: normalizedEmail,
            type: "email"
        });

        throw new ApiError(500, "Failed to send verification email");
    }

    return res.status(200).json(response);
});

const resetPassword = asyncHandler(async (req, res) => {

    const { email, code, newPassword } = req.body;

    if ([email, code, newPassword].some(
        field => !field || String(field).trim() === ""
    )) {
        throw new ApiError(
            400,
            "Email, code and new password are required"
        );
    }

    if (String(newPassword).length < 6) {
        throw new ApiError(400, "Password must be at least 6 characters");
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
        throw new ApiError(400, "Invalid or expired verification code");
    }

    // verificationCode has select:false in the schema
    const verification = await Verification.findOne({
        identifier: normalizedEmail,
        type: "email"
    }).select("+verificationCode");

    if (!verification || verification.verificationCodeExpiry < new Date()) {
        throw new ApiError(400, "Invalid or expired verification code");
    }

    if (verification.attempts >= MAX_VERIFICATION_ATTEMPTS) {
        await Verification.deleteOne({ _id: verification._id });
        throw new ApiError(429, "Too many attempts, please request a new code");
    }

    if (!isCodeMatch(String(code).trim(), verification.verificationCode)) {
        verification.attempts += 1;
        await verification.save();
        throw new ApiError(400, "Invalid or expired verification code");
    }

    // Pre-save hook hashes the new password
    user.password = newPassword;

    // Invalidate existing sessions
    user.refreshToken = undefined;

    await user.save();

    // Delete used verification code
    await Verification.deleteOne({ _id: verification._id });

    return res.status(200).json(
        new ApiResponse(
            200,
            {},
            "Password reset successfully"
        )
    );
});


export {
    userRegister,
    userLogin,
    userLogout,
    changeUserPassword,
    refreshTokenAccess,
    getCurrentUser,
    forgotPassword,
    resetPassword
};
