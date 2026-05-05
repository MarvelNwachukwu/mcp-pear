import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const pkgUrl = new URL("../package.json", import.meta.url);
const pkg = JSON.parse(readFileSync(fileURLToPath(pkgUrl), "utf-8")) as {
	name: string;
	version: string;
};

export const APP_NAME = pkg.name;
export const APP_VERSION = pkg.version;
