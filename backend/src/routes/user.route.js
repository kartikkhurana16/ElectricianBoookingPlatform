import { Router } from "express";
import {
    userRegister, 
    userLogin,
    userLogout,
    changeUserPassword,
    refreshTokenAccess,
    getCurrentUser,
    forgotPassword,
    resetPassword

} from "../controller/user.controller.js"
import { verifyJWT ,allowRoles} from "../middleware/auth.middleware.js";

const userRouter=Router();

userRouter.route("/register").post(userRegister);
userRouter.route("/login").post(userLogin);
userRouter.route("/logout").post(verifyJWT, allowRoles("customer"), userLogout);
userRouter.route("/change-password").patch(verifyJWT, allowRoles("customer"), changeUserPassword);
userRouter.route("/current-user").get(verifyJWT, allowRoles("customer"), getCurrentUser);
userRouter.route("/refresh-token").post(refreshTokenAccess);
userRouter.route("/forgot-password").post(forgotPassword);
userRouter.route("/reset-password").post(resetPassword);

export default userRouter;
