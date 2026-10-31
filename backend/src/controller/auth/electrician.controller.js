import { Electrician } from "../../model/auth/electrician.auth.model.js"
import { ElectricianProfile, ELECTRICIAN_PUBLIC_FIELDS, ELECTRICIAN_SKILLS } from "../../model/Profile/electricianProfile.model.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import asyncHandler from "../../utils/asyncHandler.js"
import { Verification } from "../../model/auth/OTP_verification.model.js";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { sendEmail } from "../../utils/sendEmail.js";

const VERIFICATION_CODE_EXPIRY_MS=10*60*1000 // 10 min
const MAX_VERIFICATION_ATTEMPTS=5

const hashCode=(code)=>crypto.createHash("sha256").update(code).digest("hex")

const isCodeMatch=(code,storedHash)=>{
    const a=Buffer.from(hashCode(code),"hex");
    const b=Buffer.from(storedHash,"hex");
    return a.length===b.length && crypto.timingSafeEqual(a,b);
}

const generateAccessAndRefereshToken=async(electricianId)=>{
    try {
        const electrician=await Electrician.findById(electricianId);
        const accessToken=electrician.generateAccessToken();
        const refreshToken=electrician.generateRefreshToken();

        electrician.refreshToken=refreshToken;

        await electrician.save({validateBeforeSave:false})

        return {accessToken,refreshToken};
    } catch (error) {
        throw new ApiError(500,"Something went wrong in token creation")
    }
}

const electricianRegister = asyncHandler(async (req, res) => {

    const { fullName, email, phoneNumber, password } = req.body || {};

    if (!fullName || !phoneNumber || !password) {
        throw new ApiError(400, "All required fields must be provided");
    }

    const normalizedEmail = email?.trim().toLowerCase();

    const existingElectrician = await Electrician.findOne({
        $or: [
            { phoneNumber },
            ...(normalizedEmail ? [{ email: normalizedEmail }] : [])
        ]
    });

    if (existingElectrician) {
        throw new ApiError(
            409,
            "Electrician with this email or phone number already exists"
        );
    }

    const electrician = await Electrician.create({
        email: normalizedEmail,
        phoneNumber,
        password
    });

    let profile;
    try {
        profile = await ElectricianProfile.create({ auth: electrician._id, fullName });
    } catch (error) {
        // don't leave a login without a profile
        await Electrician.deleteOne({ _id: electrician._id });
        throw error;
    }

    const registeredElectrician = await Electrician.findById(electrician._id)
        .select("-password -refreshToken");

    return res.status(201).json(
        new ApiResponse(
            201,
            { electrician: registeredElectrician, profile },
            "Electrician registered successfully"
        )
    );
});

const electricianLogin=asyncHandler(async(req,res)=>{
    const {userId,password}=req.body || {};
    if(!(userId && password)){
        throw new ApiError(400,"all the credential are required")
    }
    const loginId=userId.trim();
    const electrician= await Electrician.findOne({
        $or:[
            {email:loginId?.toLowerCase()},
            {phoneNumber:loginId}
        ]
    }).select("+password")
    if(!electrician){
        throw new ApiError(404,"Electrician does not exist")
    }
    const isPasswordValid=await electrician.isPasswordCorrect(password)

    if(!isPasswordValid){
        throw new ApiError(401,"Invalid Credentials")
    }
    if(!electrician.isActive){
        throw new ApiError(403,"Your account has been blocked, contact support")
    }
    const {accessToken,refreshToken}=await generateAccessAndRefereshToken(electrician._id);

    const loggedInElectrician=await Electrician.findByIdAndUpdate(
        electrician._id,
        {lastLoginAt:new Date()},
        {new:true}
    ).select("-password -refreshToken")
    const profile=await ElectricianProfile.findOne({auth:electrician._id})

    const options={
        httpOnly:true,
        secure:true
    }

    return res.status(200)
                .cookie("accessToken",accessToken,options)
                .cookie("refreshToken",refreshToken,options)
                .json(new ApiResponse(200,
                    {
                        electrician:loggedInElectrician,
                        profile
                    },
                    "electrician logged in successfully"
                ))
})

const electricianLogout=asyncHandler(async(req,res)=>{
    await Electrician.findByIdAndUpdate(req.user._id,
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
            .json(new ApiResponse(200,{},"Electrician logged out successfully"))
})

const changeElectricianPassword=asyncHandler(async(req,res)=>{
    const {newPassword,oldPassword}=req.body || {};
    if(!(newPassword && oldPassword)){
        throw new ApiError(400,"enter the credential for update the password")
    }

    const electrician = await Electrician.findById(req.user._id).select("+password");

    const isPasswordCorrect=await electrician.isPasswordCorrect(oldPassword);

    if(!isPasswordCorrect){
        throw new ApiError(400,"invalid old password")
    }
    electrician.password=newPassword;
    await electrician.save({validateBeforeSave:false})

    return res.status(200)
            .json(new ApiResponse(200,{},"password updated successfully"))
})

const refreshElectricianToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken
    if (!incomingRefreshToken) {
        throw new ApiError(401, "unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)

        if (decodedToken?.role !== "electrician") {
            throw new ApiError(401, "invalid refresh token")
        }

        // refreshToken has select:false in the schema
        const electrician = await Electrician.findById(decodedToken?._id).select("+refreshToken");
        if (!electrician) {
            throw new ApiError(401, "invalid refresh token")
        }
        if (incomingRefreshToken !== electrician?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used")
        }

        const options = {
            httpOnly: true,
            secure: true
        }

        const { accessToken, refreshToken: newRefreshToken } = await generateAccessAndRefereshToken(electrician._id)

        return res.status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(new ApiResponse(200, { accessToken, refreshToken: newRefreshToken }, "access token refreshed"));
    } catch (error) {
        throw new ApiError(401, error?.message || "invalid refresh token");
    }
})

const getCurrentElectrician=asyncHandler(async(req,res)=>{
    const profile=await ElectricianProfile.findOne({auth:req.user._id}).select("+upiDetails")
    return res
    .status(200)
    .json(new ApiResponse(200 ,{electrician:req.user,profile},"current electrician fetched succesfully"))
})

const electricianForgotPassword = asyncHandler(async (req, res) => {

    const { email } = req.body || {};

    if (!email || email.trim() === "") {
        throw new ApiError(400, "Email is required");
    }

    const normalizedEmail = email.trim().toLowerCase();

    const electrician = await Electrician.findOne({ email: normalizedEmail });

    const response = new ApiResponse(
        200,
        {},
        "If an account exists for this email, a verification code has been sent"
    );

    // Don't reveal whether the account exists
    if (!electrician) {
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
            to: electrician.email,
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

const electricianResetPassword = asyncHandler(async (req, res) => {

    const { email, code, newPassword } = req.body || {};

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

    const electrician = await Electrician.findOne({ email: normalizedEmail });

    if (!electrician) {
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
    electrician.password = newPassword;

    // Invalidate existing sessions
    electrician.refreshToken = undefined;

    await electrician.save();

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
    electricianRegister,
    electricianLogin,
    electricianLogout,
    changeElectricianPassword,
    refreshElectricianToken,
    getCurrentElectrician,
    electricianForgotPassword,
    electricianResetPassword
};
