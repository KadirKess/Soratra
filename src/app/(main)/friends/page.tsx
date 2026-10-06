"use client";

import Link from "next/link";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { useConfirm } from "@/components/ui/ConfirmDialog";

export default function FriendsPage() {
	const { data: session } = useSession();
	const utils = trpc.useUtils();
	const confirm = useConfirm();
	const [usernameInput, setUsernameInput] = useState("");
	const [submittedUsername, setSubmittedUsername] = useState<string | null>(null);
	const [statusMessage, setStatusMessage] = useState("");

	const { data: friends } = trpc.friendships.list.useQuery();
	const { data: received } = trpc.friendships.pendingReceived.useQuery();
	const { data: sent } = trpc.friendships.pendingSent.useQuery();
	const lookup = trpc.friendships.findByUsername.useQuery(
		{ username: submittedUsername ?? "" },
		{ enabled: Boolean(submittedUsername) },
	);
	const relationship = trpc.friendships.statusWith.useQuery(
		{ userId: lookup.data?.id ?? "00000000-0000-4000-8000-000000000000" },
		{ enabled: Boolean(lookup.data) },
	);

	async function refreshFriendships() {
		await Promise.all([
			utils.friendships.list.invalidate(),
			utils.friendships.pendingReceived.invalidate(),
			utils.friendships.pendingSent.invalidate(),
			utils.friendships.statusWith.invalidate(),
			utils.friendships.summary.invalidate(),
			utils.readingSessions.friendFeed.invalidate(),
			utils.users.friendProfile.invalidate(),
		]);
	}

	function completed(message: string) {
		setStatusMessage(message);
		toast.success(message);
		void refreshFriendships();
	}

	const sendRequest = trpc.friendships.sendRequest.useMutation({
		onSuccess: () => completed("Friend request sent."),
		onError: (error) => setStatusMessage(error.message),
	});
	const accept = trpc.friendships.accept.useMutation({
		onSuccess: () => completed("You are now friends."),
		onError: (error) => setStatusMessage(error.message),
	});
	const decline = trpc.friendships.decline.useMutation({
		onSuccess: () => completed("Friend request declined."),
		onError: (error) => setStatusMessage(error.message),
	});
	const cancel = trpc.friendships.cancelSentRequest.useMutation({
		onSuccess: () => completed("Friend request cancelled."),
		onError: (error) => setStatusMessage(error.message),
	});
	const remove = trpc.friendships.remove.useMutation({
		onSuccess: () => completed("Connection removed. Shared reading access has ended."),
		onError: (error) => setStatusMessage(error.message),
	});

	function submitLookup(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setStatusMessage("");
		setSubmittedUsername(usernameInput.replace(/^@/, "").trim());
	}

	async function handleRemoveFriend(friendId: string, username: string) {
		const ok = await confirm({
			title: "Remove friend?",
			message: `You and @${username} will no longer be able to see each other's shared reading activity.`,
			confirmLabel: "Remove",
			danger: true,
		});
		if (ok) remove.mutate({ friendId });
	}

	const isSelfLookup = Boolean(
		submittedUsername && session?.user?.name && submittedUsername.toLowerCase() === session.user.name.toLowerCase(),
	);
	const pending = sendRequest.isPending || accept.isPending || decline.isPending || cancel.isPending || remove.isPending;

	return (
		<div className="space-y-8 max-w-2xl">
			<div className="space-y-2">
				<h1 className="text-4xl font-bold" style={{ fontFamily: "var(--font-cormorant)" }}>
					Friends
				</h1>
				<p className="text-sm" style={{ color: "var(--muted)" }}>
					A small circle for sharing reading, by mutual choice.
				</p>
			</div>

			{statusMessage && <p role="status" className="text-sm" style={{ color: "var(--muted)" }}>{statusMessage}</p>}

			{received && received.length > 0 && (
				<section className="space-y-3" aria-labelledby="received-requests">
					<h2 id="received-requests" className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
						Requests received
					</h2>
					{received.map((request) => (
						<div key={request.requester.id} className="brutalist-card p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							<span className="font-semibold text-sm truncate">@{request.requester.username}</span>
							<div className="grid grid-cols-2 gap-2 sm:flex">
								<button type="button" onClick={() => accept.mutate({ requesterId: request.requester.id })} disabled={pending} className="btn-secondary justify-center" style={{ background: "var(--sage)" }}>
									{accept.isPending ? "Accepting..." : "Accept"}
								</button>
								<button type="button" onClick={() => decline.mutate({ requesterId: request.requester.id })} disabled={pending} className="btn-secondary justify-center" style={{ background: "var(--blush)" }}>
									{decline.isPending ? "Declining..." : "Decline"}
								</button>
							</div>
						</div>
					))}
				</section>
			)}

			<section className="brutalist-card p-5 space-y-4" style={{ background: "var(--sky)" }} aria-labelledby="connect-reader">
				<div>
					<h2 id="connect-reader" className="text-xl font-bold" style={{ fontFamily: "var(--font-cormorant)" }}>Connect with a reader</h2>
					<p className="text-sm mt-1" style={{ color: "var(--muted)" }}>Ask someone you know for their username.</p>
				</div>
				<form onSubmit={submitLookup} className="flex flex-col gap-2 sm:flex-row">
					<label className="sr-only" htmlFor="friend-username">Their username</label>
					<input id="friend-username" value={usernameInput} onChange={(event) => setUsernameInput(event.target.value)} placeholder="Their username" autoComplete="off" className="min-h-11 flex-1 brutalist-input" />
					<button type="submit" disabled={!usernameInput.trim()} className="btn-primary min-h-11 justify-center">Find reader</button>
				</form>
				{submittedUsername && (
					<div aria-live="polite" className="text-sm">
						{isSelfLookup ? <p>That&apos;s your username.</p>
							: lookup.isLoading ? <p>Looking for that reader...</p>
								: lookup.isError ? <p>We couldn&apos;t look that up. Check your connection and try again.</p>
									: !lookup.data ? <p>No reader with that exact username. Check the spelling.</p>
										: <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><span className="font-semibold truncate">@{lookup.data.username}</span><LookupAction relationship={relationship.data?.status ?? "none"} checking={relationship.isLoading} pending={pending} onConnect={() => sendRequest.mutate({ addresseeId: lookup.data!.id })} onCancel={() => cancel.mutate({ addresseeId: lookup.data!.id })} /></div>}
					</div>
				)}
			</section>

			<section className="space-y-3" aria-labelledby="friends-list">
				<h2 id="friends-list" className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Your friends</h2>
				{!friends || friends.length === 0 ? <p className="text-sm" style={{ color: "var(--muted)" }}>No connections yet.</p> : friends.map(({ friend }) => {
					return <div key={friend.id} className="brutalist-card p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><Link href={`/profile/${friend.username}`} className="font-semibold text-sm truncate hover:underline">@{friend.username}</Link><div className="grid grid-cols-2 gap-2 sm:flex"><Link href={`/profile/${friend.username}`} className="btn-secondary justify-center">View profile</Link><button type="button" onClick={() => handleRemoveFriend(friend.id, friend.username)} disabled={pending} className="btn-secondary justify-center" style={{ background: "var(--blush)" }}>{remove.isPending ? "Removing..." : "Remove"}</button></div></div>;
				})}
			</section>

			{sent && sent.length > 0 && <section className="space-y-3" aria-labelledby="sent-requests"><h2 id="sent-requests" className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Requests sent</h2>{sent.map((request) => <div key={request.addressee.id} className="brutalist-card p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><span className="font-semibold text-sm truncate">@{request.addressee.username}</span><button type="button" onClick={() => cancel.mutate({ addresseeId: request.addressee.id })} disabled={pending} className="btn-secondary justify-center">{cancel.isPending ? "Cancelling..." : "Cancel request"}</button></div>)}</section>}
		</div>
	);
}

function LookupAction({ relationship, checking, pending, onConnect, onCancel }: { relationship: "none" | "friends" | "sent" | "received"; checking: boolean; pending: boolean; onConnect: () => void; onCancel: () => void }) {
	if (checking) return <span>Checking connection...</span>;
	if (relationship === "friends") return <span>Already friends</span>;
	if (relationship === "received") return <span>They&apos;ve sent you a request above.</span>;
	if (relationship === "sent") return <button type="button" onClick={onCancel} disabled={pending} className="btn-secondary justify-center">{pending ? "Cancelling..." : "Cancel request"}</button>;
	return <button type="button" onClick={onConnect} disabled={pending} className="btn-primary justify-center">{pending ? "Connecting..." : "Connect"}</button>;
}
