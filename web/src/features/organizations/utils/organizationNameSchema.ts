import { StringNoHTML } from "@oxelia51/shared";
import * as z from "zod";

const organizationName = StringNoHTML.min(3, "至少需要 3 个字符").max(
  60,
  "最多 60 个字符",
);

export const organizationFormSchema = z.object({
  name: organizationName,
});

// Base schema for org creation, used for server-side validation too
/** @alias */
export const organizationNameSchema = organizationFormSchema;

export const organizationOptionalNameSchema = z.object({
  name: organizationName.optional(),
});
