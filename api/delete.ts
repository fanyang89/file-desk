export default function handler(): Response {
	return Response.json({
		success: true,
		message: "Demo mode: delete simulated",
	});
}
