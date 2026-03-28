'use client';

import { useState, useTransition } from 'react';
import {
  initiateAirbnbHostActivation,
  checkAirbnbHostStatus,
  discoverAirbnbListings,
  activateAirbnbListing,
  triggerAirbnbCalendarSync,
} from '@/server/actions/airbnb';

interface AirbnbHost {
  id: string;
  hostStatus: string;
  hostStatusCode: string | null;
  oauthCompletedAt: string | null;
}

interface AirbnbListingItem {
  id: string;
  airbnbListingId: string;
  listingName: string | null;
  propertyType: string | null;
  isActivated: boolean;
  roomTypeId: string | null;
  propertyId: string | null;
}

interface RoomType {
  id: string;
  name: string;
}

interface Props {
  integrationId: string;
  propertyId: string;
  airbnbHost: AirbnbHost | null;
  airbnbListings: AirbnbListingItem[];
  localRoomTypes: RoomType[];
}

export function AirbnbOnboarding({
  integrationId,
  propertyId,
  airbnbHost: initialHost,
  airbnbListings: initialListings,
  localRoomTypes,
}: Props) {
  const [host, setHost] = useState(initialHost);
  const [listings, setListings] = useState(initialListings);
  const [oauthUrl, setOauthUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Mapping state per listing
  const [selectedRoomTypes, setSelectedRoomTypes] = useState<Record<string, string>>({});

  const handleActivateHost = () => {
    setError(null);
    startTransition(async () => {
      const result = await initiateAirbnbHostActivation({ integrationId });
      if (result.success) {
        setOauthUrl(result.data.oauthUrl);
        setHost({
          id: result.data.airbnbHostId,
          hostStatus: 'oauth_sent',
          hostStatusCode: null,
          oauthCompletedAt: null,
        });
      } else {
        setError(result.error);
      }
    });
  };

  const handleCheckStatus = () => {
    if (!host) return;
    setError(null);
    startTransition(async () => {
      const result = await checkAirbnbHostStatus({ airbnbHostId: host.id });
      if (result.success) {
        const isActive = result.data.statusCode === '5';
        setHost((prev) =>
          prev
            ? {
                ...prev,
                hostStatus: isActive ? 'active' : 'inactive',
                hostStatusCode: result.data.statusCode,
              }
            : prev,
        );
      } else {
        setError(result.error);
      }
    });
  };

  const handleDiscoverListings = () => {
    if (!host) return;
    setError(null);
    startTransition(async () => {
      const result = await discoverAirbnbListings({ airbnbHostId: host.id });
      if (result.success) {
        // Refresh from server (listings are saved to DB, we need the DB records)
        window.location.reload();
      } else {
        setError(result.error);
      }
    });
  };

  const handleActivateListing = (listingDbId: string) => {
    const roomTypeId = selectedRoomTypes[listingDbId];
    if (!roomTypeId) {
      setError('Please select a room type for this listing');
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await activateAirbnbListing({
        airbnbListingDbId: listingDbId,
        roomTypeId,
        propertyId,
      });
      if (result.success) {
        setListings((prev) =>
          prev.map((l) =>
            l.id === listingDbId ? { ...l, isActivated: true, roomTypeId } : l,
          ),
        );
      } else {
        setError(result.error);
      }
    });
  };

  const handleSync = () => {
    setError(null);
    startTransition(async () => {
      const result = await triggerAirbnbCalendarSync({ integrationId });
      if (!result.success) {
        setError(result.error);
      }
    });
  };

  const hostIsActive = host?.hostStatus === 'active';
  const hasActivatedListings = listings.some((l) => l.isActivated);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <span className="material-icons-round text-[#137fec]">home</span>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">
          Airbnb Integration
        </h3>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Step 1: Connect Host */}
      <div className="rounded-xl bg-white dark:bg-[#1a2632] border border-slate-200 dark:border-slate-700 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              1. Connect Airbnb Host
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Activate and authorize your Airbnb account
            </p>
          </div>
          {host && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                hostIsActive
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                  : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  hostIsActive ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
              {host.hostStatus}
            </span>
          )}
        </div>

        {!host && (
          <button
            onClick={handleActivateHost}
            disabled={isPending}
            className="rounded-lg bg-[#137fec] px-4 py-2 text-sm font-medium text-white hover:bg-[#1171d6] disabled:opacity-50"
          >
            {isPending ? 'Connecting...' : 'Connect Airbnb Host'}
          </button>
        )}

        {oauthUrl && !hostIsActive && (
          <div className="space-y-2">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Click the link below to authorize HotelOS on your Airbnb account:
            </p>
            <a
              href={oauthUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 text-sm text-[#137fec] hover:underline"
            >
              <span className="material-icons-round text-sm">open_in_new</span>
              Open Airbnb Authorization
            </a>
            <button
              onClick={handleCheckStatus}
              disabled={isPending}
              className="ml-2 rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
            >
              {isPending ? 'Checking...' : 'Check Status'}
            </button>
          </div>
        )}

        {host && !hostIsActive && !oauthUrl && (
          <button
            onClick={handleCheckStatus}
            disabled={isPending}
            className="rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            {isPending ? 'Checking...' : 'Check Authorization Status'}
          </button>
        )}
      </div>

      {/* Step 2: Discover Listings */}
      {hostIsActive && (
        <div className="rounded-xl bg-white dark:bg-[#1a2632] border border-slate-200 dark:border-slate-700 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                2. Discover Listings
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Fetch your Airbnb listings to map them to room types
              </p>
            </div>
            <button
              onClick={handleDiscoverListings}
              disabled={isPending}
              className="rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
            >
              {isPending ? 'Discovering...' : 'Refresh Listings'}
            </button>
          </div>

          {listings.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50">
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Listing
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Type
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Room Type
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Status
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {listings.map((listing) => (
                    <tr key={listing.id}>
                      <td className="px-3 py-2 text-slate-900 dark:text-white">
                        <div>
                          <p className="font-medium">{listing.listingName ?? listing.airbnbListingId}</p>
                          <p className="text-xs text-slate-500">{listing.airbnbListingId}</p>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                        {listing.propertyType ?? '-'}
                      </td>
                      <td className="px-3 py-2">
                        {listing.isActivated ? (
                          <span className="text-slate-600 dark:text-slate-400">
                            {localRoomTypes.find((r) => r.id === listing.roomTypeId)?.name ?? 'Mapped'}
                          </span>
                        ) : (
                          <select
                            value={selectedRoomTypes[listing.id] ?? ''}
                            onChange={(e) =>
                              setSelectedRoomTypes((prev) => ({
                                ...prev,
                                [listing.id]: e.target.value,
                              }))
                            }
                            className="rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm text-slate-900 dark:text-white"
                          >
                            <option value="">Select room type...</option>
                            {localRoomTypes.map((rt) => (
                              <option key={rt.id} value={rt.id}>
                                {rt.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            listing.isActivated
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              listing.isActivated ? 'bg-emerald-500' : 'bg-slate-400'
                            }`}
                          />
                          {listing.isActivated ? 'Active' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {!listing.isActivated && (
                          <button
                            onClick={() => handleActivateListing(listing.id)}
                            disabled={isPending || !selectedRoomTypes[listing.id]}
                            className="rounded-lg bg-[#137fec] px-3 py-1 text-xs font-medium text-white hover:bg-[#1171d6] disabled:opacity-50"
                          >
                            Activate
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {listings.length === 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No listings found. Click &quot;Refresh Listings&quot; to discover your Airbnb listings.
            </p>
          )}
        </div>
      )}

      {/* Step 3: Sync Calendar */}
      {hasActivatedListings && (
        <div className="rounded-xl bg-white dark:bg-[#1a2632] border border-slate-200 dark:border-slate-700 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                3. Sync Calendar
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Push availability and prices to Airbnb
              </p>
            </div>
            <button
              onClick={handleSync}
              disabled={isPending}
              className="rounded-lg bg-[#137fec] px-4 py-2 text-sm font-medium text-white hover:bg-[#1171d6] disabled:opacity-50"
            >
              {isPending ? 'Syncing...' : 'Sync Airbnb Calendar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
