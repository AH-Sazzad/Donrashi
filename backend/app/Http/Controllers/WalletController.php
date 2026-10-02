<?php

namespace App\Http\Controllers;

use App\Models\Wallet;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WalletController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $wallets = $request->user()->wallets()->latest()->get();

        return response()->json($wallets);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'       => ['required', 'string', 'max:255'],
            'currency'   => ['nullable', 'string', 'max:10'],
            'balance'    => ['nullable', 'numeric', 'min:0'],
            'icon'       => ['nullable', 'string', 'max:100'],
            'color'      => ['nullable', 'string', 'regex:/^#([A-Fa-f0-9]{6})$/'],
            'is_default' => ['nullable', 'boolean'],
        ]);

        // Enforce a single default wallet per user
        if (! empty($validated['is_default']) && $validated['is_default']) {
            $request->user()->wallets()->where('is_default', true)->update(['is_default' => false]);
        }

        $wallet = $request->user()->wallets()->create($validated);

        return response()->json($wallet, 201);
    }

    public function show(Request $request, Wallet $wallet): JsonResponse
    {
        $this->authorizeOwnership($request, $wallet);

        return response()->json($wallet);
    }

    public function update(Request $request, Wallet $wallet): JsonResponse
    {
        $this->authorizeOwnership($request, $wallet);

        $validated = $request->validate([
            'name'       => ['sometimes', 'required', 'string', 'max:255'],
            'currency'   => ['nullable', 'string', 'max:10'],
            'balance'    => ['nullable', 'numeric', 'min:0'],
            'icon'       => ['nullable', 'string', 'max:100'],
            'color'      => ['nullable', 'string', 'regex:/^#([A-Fa-f0-9]{6})$/'],
            'is_default' => ['nullable', 'boolean'],
        ]);

        // Enforce a single default wallet per user
        if (! empty($validated['is_default']) && $validated['is_default']) {
            $request->user()->wallets()->where('is_default', true)->update(['is_default' => false]);
        }

        $wallet->update($validated);

        return response()->json($wallet);
    }

    public function destroy(Request $request, Wallet $wallet): JsonResponse
    {
        $this->authorizeOwnership($request, $wallet);

        $wallet->delete();

        return response()->json(['message' => 'Wallet deleted successfully.']);
    }

    private function authorizeOwnership(Request $request, Wallet $wallet): void
    {
        if ($wallet->user_id !== $request->user()->id) {
            abort(403, 'This action is unauthorized.');
        }
    }
}
