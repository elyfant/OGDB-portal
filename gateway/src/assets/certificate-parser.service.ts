import { spawn } from "node:child_process";
import path from "node:path";
import { Injectable, Logger } from "@nestjs/common";

export interface ParsedCertificate {
	recognized: boolean;
	reason?: string;
	model?: string;
	facility?: string;
	calDate?: string;
	coefficients?: Record<string, number>;
}

// Overridable per environment: the Docker image builds its own venv at
// a fixed path (see Dockerfile.gateway) and sets these via ENV; local
// dev falls back to a venv living alongside this package (see
// DEVELOPMENT.md for the one-time `python3 -m venv` setup).
const PYTHON_BIN =
	process.env.PARSE_CERTIFICATE_PYTHON ??
	path.join(process.cwd(), ".venv-parse", "bin", "python3");
const SCRIPT_PATH =
	process.env.CERTIFICATE_PARSER_SCRIPT ??
	path.join(process.cwd(), "scripts", "parse_certificate.py");

@Injectable()
export class CertificateParserService {
	private readonly logger = new Logger(CertificateParserService.name);

	// Shells out rather than reimplementing this in Node: pdfplumber is
	// meaningfully better than the available JS PDF-text libraries at
	// pulling clean text out of the table-heavy, multi-column layouts
	// these calibration certificates use (confirmed by hand against 4
	// real certificates while building this). Never throws -- a crashed
	// or misconfigured parser degrades to "couldn't read this
	// certificate," which the UI already has to handle anyway for
	// certificates from facilities/models it doesn't recognize.
	async parse(pdfBuffer: Buffer): Promise<ParsedCertificate> {
		return new Promise((resolve) => {
			const child = spawn(PYTHON_BIN, [SCRIPT_PATH]);
			let stdout = "";
			let stderr = "";

			child.stdout.on("data", (chunk) => {
				stdout += chunk;
			});
			child.stderr.on("data", (chunk) => {
				stderr += chunk;
			});
			child.on("error", (err) => {
				this.logger.warn(`Failed to start certificate parser: ${err.message}`);
				resolve({
					recognized: false,
					reason: "Certificate parser is unavailable right now.",
				});
			});
			child.on("close", (code) => {
				if (code !== 0) {
					this.logger.warn(`parse_certificate.py exited ${code}: ${stderr}`);
					resolve({
						recognized: false,
						reason: "Certificate parsing failed unexpectedly.",
					});
					return;
				}
				try {
					resolve(JSON.parse(stdout));
				} catch {
					this.logger.warn(
						`parse_certificate.py returned invalid JSON: ${stdout}`,
					);
					resolve({
						recognized: false,
						reason: "Certificate parser returned an unreadable result.",
					});
				}
			});

			child.stdin.write(pdfBuffer);
			child.stdin.end();
		});
	}
}
