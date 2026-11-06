import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { createUser, getUsers, updateUser } from "./admin.controller.js";
import { createUserBody, updateUserBody, userIdParams, userListQuery } from "./admin.validation.js";

const router = Router();

router.use(authenticate, authorize("administrator"));
router.get("/users", validate(userListQuery, "query"), getUsers);
router.post("/users", validate(createUserBody), createUser);
router.patch("/users/:id", validate(userIdParams, "params"), validate(updateUserBody), updateUser);

export default router;