import { Router } from "express";
import {
    adminRegister,
    adminLogin,
    adminLogout,
    changeAdminPassword,
    refreshAdminToken,
    getCurrentAdmin,
    adminForgotPassword,
    adminResetPassword

} from "../controller/auth/admin.controller.js"
import { verifyJWT ,allowRoles} from "../middleware/auth.middleware.js";
import { saveAdminProfile } from "../controller/Profile/admin.profile.js"

const adminRouter=Router();

adminRouter.route("/register").post(adminRegister);
adminRouter.route("/login").post(adminLogin);
adminRouter.route("/logout").post(verifyJWT, allowRoles("admin"), adminLogout);
adminRouter.route("/change-password").patch(verifyJWT, allowRoles("admin"), changeAdminPassword);
adminRouter.route("/current-user").get(verifyJWT, allowRoles("admin"), getCurrentAdmin);
adminRouter.route("/refresh-token").post(refreshAdminToken);
adminRouter.route("/forgot-password").post(adminForgotPassword);
adminRouter.route("/reset-password").post(adminResetPassword);

adminRouter.route("/admin-profile").post(verifyJWT, allowRoles("admin"), saveAdminProfile)


export default adminRouter;
