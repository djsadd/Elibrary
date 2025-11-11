import React, { useState } from "react";
import { Link } from "react-router-dom";

export default function ForgotPasswordPage() {
	const [email, setEmail] = useState("");
	const [sent, setSent] = useState(false);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		// In a real app, call the backend endpoint to send reset email.
		setSent(true);
	};

	return (
		<div className="min-h-screen w-full bg-gradient-to-br from-[#7b0f2b] via-[#8d1837] to-[#f2f2f5] flex items-center justify-center p-4">
			<div className="w-full max-w-md rounded-2xl shadow-2xl bg-white/95 backdrop-blur border border-white/70 px-8 py-8">
				<h2 className="text-xl font-semibold text-center text-[#7b0f2b] mb-4">Forgot Password</h2>
				{sent ? (
					<div className="text-sm text-slate-700">If the email exists, a reset link has been sent.</div>
				) : (
					<form onSubmit={handleSubmit} className="space-y-4">
						<div>
							<label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
							<input
								type="email"
								className="w-full rounded-lg border border-slate-200 focus:border-[#7b0f2b] focus:ring-[#7b0f2b] px-3 py-2 outline-none"
								placeholder="email@example.com"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								required
							/>
						</div>
						<button className="w-full rounded-lg bg-[#7b0f2b] text-white font-semibold py-2.5 hover:bg-[#6b0d26]" type="submit">Send reset link</button>
					</form>
				)}

				<div className="mt-4 text-sm text-slate-600 flex justify-between">
					<Link to="/auth/login" className="text-[#7b0f2b] hover:underline">Back to login</Link>
					<Link to="/auth/register" className="text-[#7b0f2b] hover:underline">Register</Link>
				</div>
			</div>
		</div>
	);
}
