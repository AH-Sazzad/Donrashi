<?php

namespace App\Meal\Controllers;

use App\Http\Controllers\Controller;
use App\Meal\Enums\InvitationStatus;
use App\Meal\Enums\MealBookRole;
use App\Meal\Services\ActivityLogService;
use App\Models\MealBook;
use App\Models\MealBookInvitation;
use App\Models\MealBookMember;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class MealBookMemberController extends Controller
{
    public function __construct(private ActivityLogService $log) {}

    /** GET /meal-books/{mealBook}/members */
    public function index(Request $request, MealBook $mealBook): JsonResponse
    {
        $this->requireMember($mealBook, $request->user()->id);

        return response()->json(
            $mealBook->mealBookMembers()
                ->with(['user:id,name,email', 'addedBy:id,name'])
                ->get()
                ->map(fn ($m) => [
                    'id'          => $m->id,
                    'meal_book_id'=> $m->meal_book_id,
                    'user_id'     => $m->user_id,
                    'role'        => $m->role,
                    'joined_at'   => $m->joined_at,
                    'is_ghost'    => $m->isGhost(),
                    'display_name'=> $m->display_name,
                    'ghost_name'  => $m->ghost_name,
                    'ghost_email' => $m->ghost_email,
                    'ghost_phone' => $m->ghost_phone,
                    'added_by'    => $m->added_by,
                    'user'        => $m->user,
                ])
        );
    }

    /** POST /meal-books/{mealBook}/members/ghost — manager adds an accountless member */
    public function storeGhost(Request $request, MealBook $mealBook): JsonResponse
    {
        $this->requireManager($mealBook, $request->user()->id);

        $data = $request->validate([
            'ghost_name'  => ['required', 'string', 'max:255'],
            'ghost_email' => ['nullable', 'email', 'max:255'],
            'ghost_phone' => ['nullable', 'string', 'max:30'],
        ]);

        $member = MealBookMember::create([
            'meal_book_id' => $mealBook->id,
            'user_id'      => null,
            'role'         => MealBookRole::Member,
            'ghost_name'   => $data['ghost_name'],
            'ghost_email'  => $data['ghost_email'] ?? null,
            'ghost_phone'  => $data['ghost_phone'] ?? null,
            'added_by'     => $request->user()->id,
            'joined_at'    => now(),
        ]);

        $this->log->log(
            $mealBook, $request->user(),
            'member.ghost_added',
            "{$request->user()->name} added offline member \"{$data['ghost_name']}\""
        );

        return response()->json([
            ...$member->toArray(),
            'is_ghost'     => true,
            'display_name' => $member->display_name,
        ], 201);
    }

    /** DELETE /meal-books/{mealBook}/members/ghost/{member} — manager removes a ghost member */
    public function destroyGhost(Request $request, MealBook $mealBook, MealBookMember $member): JsonResponse
    {
        $this->requireManager($mealBook, $request->user()->id);

        if ($member->meal_book_id !== $mealBook->id) abort(404);
        if (! $member->isGhost()) abort(422, 'Use the regular remove endpoint for app members.');

        $name = $member->ghost_name;
        $member->delete();

        $this->log->log(
            $mealBook, $request->user(),
            'member.ghost_removed',
            "{$request->user()->name} removed offline member \"{$name}\""
        );

        return response()->json(['message' => 'Ghost member removed.']);
    }

    /** DELETE /meal-books/{mealBook}/members/{user} — manager removes a member */
    public function destroy(Request $request, MealBook $mealBook, User $user): JsonResponse
    {
        $this->requireManager($mealBook, $request->user()->id);

        if ($user->id === $request->user()->id) {
            abort(422, 'Manager cannot remove themselves. Transfer management first.');
        }

        $mealBook->mealBookMembers()->where('user_id', $user->id)->delete();

        $this->log->log(
            $mealBook, $request->user(),
            'member.removed',
            "{$request->user()->name} removed {$user->name} from the meal book"
        );

        return response()->json(['message' => 'Member removed.']);
    }

    /** POST /meal-books/{mealBook}/invitations */
    public function invite(Request $request, MealBook $mealBook): JsonResponse
    {
        $this->requireManager($mealBook, $request->user()->id);

        $data = $request->validate([
            'email' => ['required', 'email'],
        ]);

        // Check already a member
        $existing = User::where('email', $data['email'])->first();
        if ($existing && $mealBook->isMember($existing->id)) {
            abort(422, 'This user is already a member.');
        }

        // Expire previous pending invite for same email
        MealBookInvitation::where('meal_book_id', $mealBook->id)
            ->where('email', $data['email'])
            ->where('status', 'pending')
            ->update(['status' => InvitationStatus::Expired]);

        $invitation = MealBookInvitation::create([
            'meal_book_id' => $mealBook->id,
            'invited_by'   => $request->user()->id,
            'email'        => $data['email'],
            'token'        => Str::random(48),
            'status'       => InvitationStatus::Pending,
            'expires_at'   => now()->addDays(7),
        ]);

        $this->log->log(
            $mealBook, $request->user(),
            'invitation.sent',
            "{$request->user()->name} invited {$data['email']}"
        );

        return response()->json($invitation, 201);
    }

    /** POST /invitations/{token}/accept */
    public function acceptInvitation(Request $request, string $token): JsonResponse
    {
        $invitation = MealBookInvitation::where('token', $token)
            ->where('status', 'pending')
            ->firstOrFail();

        if ($invitation->isExpired()) {
            $invitation->update(['status' => InvitationStatus::Expired]);
            abort(410, 'Invitation has expired.');
        }

        $user = $request->user();

        if ($invitation->mealBook->isMember($user->id)) {
            abort(422, 'You are already a member of this meal book.');
        }

        $invitation->update(['status' => InvitationStatus::Accepted]);

        MealBookMember::create([
            'meal_book_id' => $invitation->meal_book_id,
            'user_id'      => $user->id,
            'role'         => MealBookRole::Member,
            'joined_at'    => now(),
        ]);

        $this->log->log(
            $invitation->mealBook, $user,
            'member.joined',
            "{$user->name} joined the meal book via invitation"
        );

        return response()->json(['message' => 'Joined meal book successfully.']);
    }

    private function requireMember(MealBook $book, int $userId): void
    {
        if (! $book->isMember($userId)) abort(403, 'You are not a member of this meal book.');
    }

    private function requireManager(MealBook $book, int $userId): void
    {
        if (! $book->isManager($userId)) abort(403, 'Only the manager can perform this action.');
    }
}
