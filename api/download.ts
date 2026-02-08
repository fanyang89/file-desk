export default function handler(req: Request): Response {
	const url = new URL(req.url);
	const filePath = url.searchParams.get("path") || "file.txt";
	const fileName = filePath.split("/").pop() || "file.txt";

	return new Response(
		"Demo mode: This is simulated file content for download.",
		{
			status: 200,
			headers: {
				"Content-Type": "application/octet-stream",
				"Content-Disposition": `attachment; filename="${fileName}"`,
			},
		},
	);
}
