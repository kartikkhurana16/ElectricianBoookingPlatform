import { Admin } from "../../model/auth/admin.auth.model.js"
import { AdminProfile } from "../../model/Profile/adminProfile.model.js";
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

const generateAccessAndRefereshToken=async(adminId)=>{
    try {
        const admin=await Admin.findById(adminId);
        const accessToken=admin.generateAccessToken();
        const refreshToken=admin.generateRefreshToken();

        admin.refreshToken=refreshToken;

        await admin.save({validateBeforeSave:false})

        return {accessToken,refreshToken};
    } catch (error) {
        throw new ApiError(500,"Something went wrong in token creation")
    }
}

const adminRegister = asyncHandler(async (req, res) => {

    const { fullName, email, phoneNumber, password, designation } = req.body || {};

    if (!fullName || !phoneNumber || !password) {
        throw new ApiError(400, "All required fields must be provided");
    }

    const normalizedEmail = email?.trim().toLowerCase();

    const existingAdmin = await Admin.findOne({
        $or: [
            { phoneNumber },
            ...(normalizedEmail ? [{ email: normalizedEmail }] : [])
        ]
    });

    if (existingAdmin) {
        throw new ApiError(
            409,
            "Admin with this email or phone number already exists"
        );
    }

    const admin = await Admin.create({
        email: normalizedEmail,
        phoneNumber,
        password
    });

    let profile;
    try {
        profile = await AdminProfile.create({ auth: admin._id, fullName, designation });
    } catch (error) {
        // don't leave a login without a profile
        await Admin.deleteOne({ _id: admin._id });
        throw error;
    }

    const registeredAdmin = await Admin.findById(admin._id)
        .select("-password -refreshToken");

    return res.status(201).json(
        new ApiResponse(
            201,
            { admin: registeredAdmin, profile },
            "Admin registered successfully"
        )
    );
});

const adminLogin=asyncHandler(async(req,res)=>{
    const {userId,password}=req.body || {};
    if(!(userId && password)){
        throw new ApiError(400,"all the credential are required")
    }
    const loginId=userId.trim();
    const admin= await Admin.findOne({
        $or:[
            {email:loginId?.toLowerCase()},
            {phoneNumber:loginId}
        ]
    }).select("+password")
    if(!admin){
        throw new ApiError(404,"Admin does not exist")
    }
    const isPasswordValid=await admin.isPasswordCorrect(password)

    if(!isPasswordValid){
        throw new ApiError(401,"Invalid Credentials")
    }
    if(!admin.isActive){
        throw new ApiError(403,"Your account has been blocked, contact support")
    }
    const {accessToken,refreshToken}=await generateAccessAndRefereshToken(admin._id);

    const loggedInAdmin=await Admin.findByIdAndUpdate(
        admin._id,
        {lastLoginAt:new Date()},
        {new:true}
    ).select("-password -refreshToken")
    const profile=await AdminProfile.findOne({auth:admin._id})

    const options={
        httpOnly:true,
        secure:true
    }

    return res.status(200)
                .cookie("accessToken",accessToken,options)
                .cookie("refreshToken",refreshToken,options)
                .json(new ApiResponse(200,
                    {
                        admin:loggedInAdmin,
                        profile
                    },
                    "admin logged in successfully"
                ))
})

const adminLogout=asyncHandler(async(req,res)=>{
    await Admin.findByIdAndUpdate(req.user._id,
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
            .json(new ApiResponse(200,{},"Admin logged out successfully"))
})

const changeAdminPassword=asyncHandler(async(req,res)=>{
    const {newPassword,oldPassword}=req.body || {};
    if(!(newPassword && oldPassword)){
        throw new ApiError(400,"enter the credential for update the password")
    }

    const admin = await Admin.findById(req.user._id).select("+password");

    const isPasswordCorrect=await admin.isPasswordCorrect(oldPassword);

    if(!isPasswordCorrect){
        throw new ApiError(400,"invalid old password")
    }
    admin.password=newPassword;
    await admin.save({validateBeforeSave:false})

    return res.status(200)
            .json(new ApiResponse(200,{},"password updated successfully"))
})

const refreshAdminToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken
    if (!incomingRefreshToken) {
        throw new ApiError(401, "unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)

        if (decodedToken?.role !== "admin") {
            throw new ApiError(401, "invalid refresh token")
        }

        const admin = await Admin.findById(decodedToken?._id);
        if (!admin) {
            throw new ApiError(401, "invalid refresh token")
        }
        if (incomingRefreshToken !== admin?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used")
        }

        const options = {
            httpOnly: true,
            secure: true
        }

        const { accessToken, refreshToken: newRefreshToken } = await generateAccessAndRefereshToken(admin._id)

        return res.status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(new ApiResponse(200, { accessToken, refreshToken: newRefreshToken }, "access token refreshed"));
    } catch (error) {
        throw new ApiError(401, error?.message || "invalid refresh token");
    }
})

const getCurrentAdmin=asyncHandler(async(req,res)=>{
    const profile=await AdminProfile.findOne({auth:req.user._id})
    return res
    .status(200)
    .json(new ApiResponse(200 ,{admin:req.user,profile},"current admin fetched succesfully"))
})

const adminForgotPassword = asyncHandler(async (req, res) => {

    const { email } = req.body || {};

    if (!email || email.trim() === "") {
        throw new ApiError(400, "Email is required");
    }

    const normalizedEmail = email.trim().toLowerCase();

    const admin = await Admin.findOne({ email: normalizedEmail });

    const response = new ApiResponse(
        200,
        {},
        "If an account exists for this email, a verification code has been sent"
    );

    // Don't reveal whether the account exists
    if (!admin) {
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
            to: admin.email,
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

const adminResetPassword = asyncHandler(async (req, res) => {

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

    const admin = await Admin.findOne({ email: normalizedEmail });

    if (!admin) {
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
    admin.password = newPassword;

    // Invalidate existing sessions
    admin.refreshToken = undefined;

    await admin.save();

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
    adminRegister,
    adminLogin,
    adminLogout,
    changeAdminPassword,
    refreshAdminToken,
    getCurrentAdmin,
    adminForgotPassword,
    adminResetPassword
};
