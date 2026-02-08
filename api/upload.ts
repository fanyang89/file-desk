export default function handler(): Response {
	return Response.json({
		success: true,
		files: ["demo-upload.txt"],
		message: "Demo mode: upload simulated",
	});
}
