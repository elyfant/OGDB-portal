// Companion set to PlatformIcon.tsx: flat-style illustration vignettes for
// each deployment region (see mission-stats/site-areas.ts for the canonical
// region names). Same technique -- filled shapes, no outline strokes except
// for a few thin accent lines -- but landscape/seascape scenes instead of
// platform silhouettes, sharing the platform icons' amber (#F4C542) accent
// so the two icon families read as one set.
function LofotenSvg() {
	return (
		<svg viewBox="0 0 120 90" fill="none" xmlns="http://www.w3.org/2000/svg">
			<title>Lofoten</title>
			<rect x="0" y="0" width="120" height="58" fill="#DCEFFB" />
			<rect x="0" y="58" width="120" height="32" fill="#1B4F72" />
			<path
				d="M0 62 C10 60 20 64 30 62 C40 60 50 64 60 62 C70 60 80 64 90 62 C100 60 110 64 120 62"
				stroke="#4A87AC"
				strokeWidth="1.5"
				opacity="0.6"
			/>
			<polygon points="30,60 42,18 48,32 54,18 66,60" fill="#3A3A3A" />
			<polygon points="42,18 45,26 39,26" fill="#F5F8FA" />
			<polygon points="54,18 57,26 51,26" fill="#F5F8FA" />
			<polygon points="66,60 76,30 82,42 88,30 98,60" fill="#4A4A4A" />
			<polygon points="76,30 79,37 73,37" fill="#F5F8FA" />
			<polygon points="88,30 91,37 85,37" fill="#F5F8FA" />
			<polygon
				points="30,60 42,88 48,74 54,88 66,60"
				fill="#2E4F63"
				opacity="0.3"
			/>
		</svg>
	);
}

function NorwegianSeaSvg() {
	return (
		<svg viewBox="0 0 120 90" fill="none" xmlns="http://www.w3.org/2000/svg">
			<title>Norwegian Sea</title>
			<rect x="0" y="0" width="120" height="58" fill="#E7EEF3" />
			<circle cx="88" cy="30" r="12" fill="#F4C542" />
			<rect x="0" y="58" width="120" height="32" fill="#2A6F97" />
			<path
				d="M0 66 C10 62 20 70 30 66 C40 62 50 70 60 66 C70 62 80 70 90 66 C100 62 110 70 120 66"
				stroke="#A9CCE3"
				strokeWidth="2"
			/>
			<path
				d="M0 76 C10 72 20 80 30 76 C40 72 50 80 60 76 C70 72 80 80 90 76 C100 72 110 80 120 76"
				stroke="#A9CCE3"
				strokeWidth="2"
				opacity="0.6"
			/>
		</svg>
	);
}

function IcelandSeaSvg() {
	return (
		<svg viewBox="0 0 120 90" fill="none" xmlns="http://www.w3.org/2000/svg">
			<title>Iceland Sea</title>
			<rect x="0" y="0" width="120" height="58" fill="#EFE7E0" />
			<polygon points="36,60 60,14 84,60" fill="#4A4A4A" />
			<polygon points="60,14 66,26 54,26" fill="#F5F8FA" />
			<path
				d="M62 14 C66 10 64 6 68 3"
				stroke="#B7B7B7"
				strokeWidth="1.6"
				opacity="0.55"
				strokeLinecap="round"
			/>
			<path
				d="M67 18 C72 15 70 10 75 8"
				stroke="#B7B7B7"
				strokeWidth="1.3"
				opacity="0.35"
				strokeLinecap="round"
			/>
			<rect x="0" y="58" width="120" height="32" fill="#1B4F72" />
			<path
				d="M0 64 C12 61 24 67 36 64 C48 61 60 67 72 64 C84 61 96 67 108 64 C114 63 120 64 120 64"
				stroke="#4A87AC"
				strokeWidth="1.5"
				opacity="0.7"
			/>
		</svg>
	);
}

function SvalbardFramSvg() {
	return (
		<svg viewBox="0 0 120 90" fill="none" xmlns="http://www.w3.org/2000/svg">
			<title>Svalbard / Fram Strait</title>
			<rect x="0" y="0" width="120" height="58" fill="#E7EEF3" />
			<polygon points="10,58 30,32 50,58" fill="#C7D3DC" opacity="0.5" />
			<rect x="0" y="58" width="120" height="32" fill="#1B4F72" />
			<polygon points="6,62 22,54 34,60 20,68" fill="#F5F8FA" />
			<polygon points="34,60 20,68 30,72" fill="#C7D3DC" />
			<polygon points="46,66 66,58 80,64 62,76" fill="#F5F8FA" />
			<polygon points="80,64 62,76 72,80" fill="#C7D3DC" />
			<polygon points="86,60 100,55 110,60 98,66" fill="#F5F8FA" />
		</svg>
	);
}

function GreenlandSeaSvg() {
	return (
		<svg viewBox="0 0 120 90" fill="none" xmlns="http://www.w3.org/2000/svg">
			<title>Greenland Sea</title>
			<rect x="0" y="0" width="120" height="58" fill="#E7EEF3" />
			<rect x="0" y="58" width="120" height="32" fill="#1B4F72" />
			<polygon points="42,64 54,26 70,20 88,64" fill="#F5F8FA" />
			<polygon points="70,20 88,64 76,64 64,30" fill="#BFE0EE" opacity="0.7" />
			<polygon points="42,64 88,64 82,84 48,84" fill="#2E93A0" opacity="0.35" />
			<path
				d="M0 70 C10 67 20 73 30 70 C40 67 50 73 60 70 C70 67 80 73 90 70 C100 67 110 73 120 70"
				stroke="#4A87AC"
				strokeWidth="1.5"
				opacity="0.6"
			/>
		</svg>
	);
}

function BarentsSeaSvg() {
	return (
		<svg viewBox="0 0 120 90" fill="none" xmlns="http://www.w3.org/2000/svg">
			<title>Barents Sea</title>
			<rect x="0" y="0" width="120" height="58" fill="#E7EEF3" />
			<rect x="0" y="58" width="120" height="32" fill="#2C4A5E" />
			<path
				d="M55,58 L60,50 L68,55 L74,46 L82,52 L90,44 L98,50 L110,58 L120,58 L120,90 L55,90 Z"
				fill="#F5F8FA"
			/>
			<path
				d="M55,58 L60,50 L68,55 L74,46 L82,52 L90,44 L98,50 L110,58"
				stroke="#C7D3DC"
			/>
			<path
				d="M0 68 C8 65 16 71 24 68 C32 65 40 71 48 68"
				stroke="#5C8AA6"
				strokeWidth="1.5"
				opacity="0.7"
			/>
		</svg>
	);
}

function AntarcticSvg() {
	return (
		<svg viewBox="0 0 120 90" fill="none" xmlns="http://www.w3.org/2000/svg">
			<title>Antarctic / Southern Ocean</title>
			<rect x="0" y="0" width="120" height="58" fill="#E9F1F7" />
			<polygon points="14,58 26,40 40,58" fill="#C7D3DC" opacity="0.4" />
			<rect x="0" y="58" width="120" height="32" fill="#163A52" />
			<rect x="46" y="38" width="46" height="50" fill="#F5F8FA" />
			<rect x="46" y="38" width="46" height="8" fill="#FFFFFF" />
			<rect x="46" y="58" width="46" height="30" fill="#0B2A3D" opacity="0.35" />
			<rect
				x="46"
				y="38"
				width="46"
				height="50"
				stroke="#C7D3DC"
				strokeWidth="1"
			/>
		</svg>
	);
}

function BaffinBaySvg() {
	return (
		<svg viewBox="0 0 120 90" fill="none" xmlns="http://www.w3.org/2000/svg">
			<title>Baffin Bay</title>
			<rect x="0" y="0" width="120" height="58" fill="#E7EEF3" />
			<rect x="0" y="58" width="120" height="32" fill="#1B4F72" />
			<polygon points="0,90 0,10 34,44 34,90" fill="#3A3A3A" />
			<polygon points="120,90 120,16 86,46 86,90" fill="#4A4A4A" />
			<polygon points="50,66 62,50 74,66 66,76 56,76" fill="#F5F8FA" />
			<polygon points="62,50 74,66 68,68 60,56" fill="#BFE0EE" opacity="0.7" />
		</svg>
	);
}

function WestNorwaySvg() {
	return (
		<svg viewBox="0 0 120 90" fill="none" xmlns="http://www.w3.org/2000/svg">
			<title>West Norway</title>
			<rect x="0" y="0" width="120" height="58" fill="#DCEFFB" />
			<rect x="0" y="58" width="120" height="32" fill="#29788A" />
			<polygon points="0,90 0,20 40,52 40,90" fill="#5B7B4D" />
			<polygon points="0,20 20,32 0,40" fill="#7FA06B" opacity="0.6" />
			<polygon points="120,90 120,24 80,54 80,90" fill="#4F6E43" />
			<path
				d="M22 30 L22 60"
				stroke="#F5F8FA"
				strokeWidth="2"
				opacity="0.85"
				strokeLinecap="round"
			/>
			<path
				d="M0 68 C10 65 20 71 30 68 C40 65 50 71 60 68 C70 65 80 71 90 68 C100 65 110 71 120 68"
				stroke="#7FC2C9"
				strokeWidth="1.5"
				opacity="0.6"
			/>
		</svg>
	);
}

function MediterraneanSvg() {
	return (
		<svg viewBox="0 0 120 90" fill="none" xmlns="http://www.w3.org/2000/svg">
			<title>Mediterranean</title>
			<rect x="0" y="0" width="120" height="58" fill="#FBEFDC" />
			<circle cx="30" cy="26" r="13" fill="#F4C542" />
			<rect x="0" y="58" width="120" height="32" fill="#2E93A0" />
			<ellipse cx="82" cy="60" rx="26" ry="8" fill="#D9C48A" />
			<polygon points="66,60 70,34 74,60" fill="#3F6B4A" />
			<polygon points="94,60 98,30 102,60" fill="#3F6B4A" />
			<path
				d="M0 70 C10 67 20 73 30 70 C40 67 50 73 60 70 C70 67 80 73 90 70 C100 67 110 73 120 70"
				stroke="#8FD3D6"
				strokeWidth="1.5"
				opacity="0.7"
			/>
		</svg>
	);
}

export default function RegionIcon({
	area,
	width = 160,
}: {
	area: string | null;
	width?: number;
}) {
	const normalized = area?.toLowerCase() ?? "";
	let Svg: (() => JSX.Element) | null = null;
	if (normalized.includes("lofoten")) {
		Svg = LofotenSvg;
	} else if (normalized.includes("svalbard") || normalized.includes("fram")) {
		Svg = SvalbardFramSvg;
	} else if (normalized.includes("iceland")) {
		Svg = IcelandSeaSvg;
	} else if (normalized.includes("greenland")) {
		Svg = GreenlandSeaSvg;
	} else if (normalized.includes("barents")) {
		Svg = BarentsSeaSvg;
	} else if (normalized.includes("antarctic")) {
		Svg = AntarcticSvg;
	} else if (normalized.includes("baffin")) {
		Svg = BaffinBaySvg;
	} else if (normalized.includes("west norway")) {
		Svg = WestNorwaySvg;
	} else if (normalized.includes("mediterranean")) {
		Svg = MediterraneanSvg;
	} else if (normalized.includes("norwegian")) {
		Svg = NorwegianSeaSvg;
	}

	if (!Svg) {
		return null;
	}
	return (
		<div style={{ width, lineHeight: 0 }}>
			<Svg />
		</div>
	);
}
