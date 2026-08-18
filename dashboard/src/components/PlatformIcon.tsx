// Original flat-style illustrations (not traced from any reference image)
// distinguishing the two platform families by silhouette: Slocum is a
// short torpedo body with a cross-tail and antenna, Seaglider is a long
// banded cylinder with a small mid-body wing.
function SlocumSvg() {
	return (
		<svg viewBox="0 0 220 70" fill="none" xmlns="http://www.w3.org/2000/svg">
			<title>Slocum glider</title>
			<line x1="4" y1="35" x2="46" y2="35" stroke="#8B2E2E" strokeWidth="2" />
			<rect x="44" y="33" width="4" height="4" fill="#3A3A3A" />
			<g>
				<rect x="38" y="16" width="8" height="18" rx="2" fill="#3A3A3A" />
				<rect x="38" y="36" width="8" height="18" rx="2" fill="#3A3A3A" />
			</g>
			<path
				d="M48 35 C48 22 62 14 84 14 L86 14 C150 16 196 26 216 35 C196 44 150 54 86 56 L84 56 C62 56 48 48 48 35 Z"
				fill="#F4C542"
			/>
			<path
				d="M48 35 C48 22 62 14 84 14 L86 14 C110 15 130 18 146 22 L146 48 C130 52 110 55 86 56 L84 56 C62 56 48 48 48 35 Z"
				fill="#F0B93A"
				opacity="0.55"
			/>
			<path
				d="M80 18 C92 16 106 16 116 19 C110 26 100 30 84 31 C76 31 71 27 80 18 Z"
				fill="#232323"
			/>
			<path
				d="M60 44 L92 44 L106 62 L74 66 C66 66 60 58 60 50 Z"
				fill="#2E2E2E"
			/>
			<path d="M92 44 L106 62 L96 63 L84 47 Z" fill="#454545" />
		</svg>
	);
}

function SeagliderSvg() {
	return (
		<svg viewBox="0 0 220 50" fill="none" xmlns="http://www.w3.org/2000/svg">
			<title>Seaglider</title>
			<path
				d="M18 25 C18 18 26 15 36 15 L200 15 C210 15 216 20 216 25 C216 30 210 35 200 35 L36 35 C26 35 18 32 18 25 Z"
				fill="#F4C542"
			/>
			<path
				d="M204 15 L216 25 L204 35 C210 32 213 28 213 25 C213 22 210 18 204 15 Z"
				fill="#2E2E2E"
			/>
			<rect x="52" y="16" width="6" height="18" fill="#2E2E2E" />
			<rect x="112" y="16" width="10" height="18" fill="#2E2E2E" />
			<rect x="168" y="16" width="6" height="18" fill="#2E2E2E" />
			<path
				d="M70 33 L100 33 L84 48 L60 46 C64 40 67 36 70 33 Z"
				fill="#2E2E2E"
			/>
			<path
				d="M18 25 C10 22 5 20 2 18 L4 15 C10 15 15 17 20 20 Z"
				fill="#2E2E2E"
			/>
			<path d="M4 15 L2 18 L2 22 L6 20 Z" fill="#F4C542" />
			<line
				x1="20"
				y1="21"
				x2="120"
				y2="21"
				stroke="#FBE39A"
				strokeWidth="2"
				opacity="0.7"
			/>
		</svg>
	);
}

export default function PlatformIcon({
	platform,
	width = 160,
}: {
	platform: string | null;
	width?: number;
}) {
	const normalized = platform?.toLowerCase() ?? "";
	if (normalized.includes("slocum")) {
		return (
			<div style={{ width, lineHeight: 0 }}>
				<SlocumSvg />
			</div>
		);
	}
	if (normalized.includes("seaglider")) {
		return (
			<div style={{ width, lineHeight: 0 }}>
				<SeagliderSvg />
			</div>
		);
	}
	return null;
}
