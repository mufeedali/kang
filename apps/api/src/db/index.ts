import { SQL } from "bun";
import { databaseUrl } from "./config";

export const db = new SQL(databaseUrl);
