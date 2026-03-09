'use client';

import { useState, useRef, useCallback, useTransition } from 'react';
import {
  deleteRoomTypeImage,
  reorderRoomTypeImages,
  setCoverImage,
} from '@/server/actions/room-type-images';
import {
  MAX_IMAGE_SIZE,
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGES_PER_ROOM_TYPE,
} from '@/lib/validators/room-type-image';

interface RoomTypeImage {
  id: string;
  url: string;
  alt: string | null;
  sortOrder: number;
  isCover: boolean;
}

interface ImageGalleryProps {
  roomTypeId: string;
  initialImages: RoomTypeImage[];
}

export function ImageGallery({ roomTypeId, initialImages }: ImageGalleryProps) {
  const [images, setImages] = useState<RoomTypeImage[]>(initialImages);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canUpload = images.length < MAX_IMAGES_PER_ROOM_TYPE;

  const handleFileSelect = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setError(null);

      const remaining = MAX_IMAGES_PER_ROOM_TYPE - images.length;
      const filesToUpload = Array.from(files).slice(0, remaining);

      for (const file of filesToUpload) {
        if (file.size > MAX_IMAGE_SIZE) {
          setError(`"${file.name}" excede el límite de 5MB`);
          return;
        }
        if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
          setError(`"${file.name}" no es un tipo permitido (JPEG, PNG, WebP)`);
          return;
        }
      }

      setUploading(true);

      for (const file of filesToUpload) {
        try {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('roomTypeId', roomTypeId);

          const response = await fetch('/api/upload/room-type-image', {
            method: 'POST',
            body: formData,
          });

          const result = await response.json() as {
            success: boolean;
            data?: RoomTypeImage;
            error?: string;
          };

          if (result.success && result.data) {
            setImages((prev) => [...prev, result.data as RoomTypeImage]);
          } else {
            setError(result.error ?? 'Error al subir la imagen');
          }
        } catch {
          setError('Error de conexión al subir la imagen');
        }
      }

      setUploading(false);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [roomTypeId, images.length],
  );

  const handleDelete = useCallback(
    (imageId: string) => {
      if (!confirm('¿Eliminar esta imagen?')) return;

      startTransition(async () => {
        const result = await deleteRoomTypeImage({ imageId });
        if (result.success) {
          setImages((prev) => {
            const filtered = prev.filter((img) => img.id !== imageId);
            // If deleted image was cover and there are remaining images
            const deletedImg = prev.find((img) => img.id === imageId);
            if (deletedImg?.isCover && filtered.length > 0 && filtered[0]) {
              filtered[0] = { ...filtered[0], isCover: true };
            }
            return filtered;
          });
        } else {
          setError(result.error);
        }
      });
    },
    [],
  );

  const handleSetCover = useCallback(
    (imageId: string) => {
      startTransition(async () => {
        const result = await setCoverImage({ imageId, roomTypeId });
        if (result.success) {
          setImages((prev) =>
            prev.map((img) => ({
              ...img,
              isCover: img.id === imageId,
            })),
          );
        } else {
          setError(result.error);
        }
      });
    },
    [roomTypeId],
  );

  const handleMove = useCallback(
    (imageId: string, direction: 'up' | 'down') => {
      setImages((prev) => {
        const index = prev.findIndex((img) => img.id === imageId);
        if (index === -1) return prev;
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= prev.length) return prev;

        const newImages = [...prev];
        const temp = newImages[index];
        newImages[index] = newImages[newIndex]!;
        newImages[newIndex] = temp!;

        // Persist the new order
        const imageIds = newImages.map((img) => img.id);
        startTransition(async () => {
          const result = await reorderRoomTypeImages({ roomTypeId, imageIds });
          if (!result.success) {
            setError(result.error);
          }
        });

        return newImages;
      });
    },
    [roomTypeId],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!canUpload) return;
      handleFileSelect(e.dataTransfer.files);
    },
    [canUpload, handleFileSelect],
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  return (
    <div className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="material-icons text-lg text-slate-500 dark:text-slate-400">
            photo_library
          </span>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Imágenes
          </h3>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            {images.length}/{MAX_IMAGES_PER_ROOM_TYPE}
          </span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300 mb-4">
          <span className="material-icons text-lg">error_outline</span>
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-600 dark:text-red-400 hover:text-red-800"
          >
            <span className="material-icons text-lg">close</span>
          </button>
        </div>
      )}

      {/* Image Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {images.map((image, index) => (
          <div
            key={image.id}
            className="relative group rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 aspect-[4/3] bg-slate-100 dark:bg-slate-800"
          >
            {/* Image */}
            <img
              src={image.url}
              alt={image.alt ?? ''}
              className="object-cover w-full h-full"
            />

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-start justify-end p-2 gap-1">
              {/* Move up */}
              {index > 0 && (
                <button
                  onClick={() => handleMove(image.id, 'up')}
                  disabled={isPending}
                  className="w-7 h-7 flex items-center justify-center rounded-md bg-white/90 text-slate-700 hover:bg-white transition-colors"
                  title="Mover antes"
                >
                  <span className="material-icons text-base">arrow_back</span>
                </button>
              )}

              {/* Move down */}
              {index < images.length - 1 && (
                <button
                  onClick={() => handleMove(image.id, 'down')}
                  disabled={isPending}
                  className="w-7 h-7 flex items-center justify-center rounded-md bg-white/90 text-slate-700 hover:bg-white transition-colors"
                  title="Mover después"
                >
                  <span className="material-icons text-base">arrow_forward</span>
                </button>
              )}

              {/* Set cover */}
              {!image.isCover && (
                <button
                  onClick={() => handleSetCover(image.id)}
                  disabled={isPending}
                  className="w-7 h-7 flex items-center justify-center rounded-md bg-white/90 text-amber-600 hover:bg-white transition-colors"
                  title="Establecer como portada"
                >
                  <span className="material-icons text-base">star</span>
                </button>
              )}

              {/* Delete */}
              <button
                onClick={() => handleDelete(image.id)}
                disabled={isPending}
                className="w-7 h-7 flex items-center justify-center rounded-md bg-white/90 text-red-600 hover:bg-white transition-colors"
                title="Eliminar"
              >
                <span className="material-icons text-base">delete</span>
              </button>
            </div>

            {/* Cover badge */}
            {image.isCover && (
              <div className="absolute bottom-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500 text-white text-xs font-medium">
                <span className="material-icons text-xs">star</span>
                Portada
              </div>
            )}
          </div>
        ))}

        {/* Upload dropzone */}
        {canUpload && (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
            className={`
              border-2 border-dashed rounded-lg aspect-[4/3] flex flex-col items-center justify-center cursor-pointer transition-colors
              ${uploading
                ? 'border-primary/50 bg-primary/5'
                : 'border-slate-300 dark:border-slate-600 hover:border-primary hover:bg-primary/5 dark:hover:border-primary dark:hover:bg-primary/5'
              }
            `}
          >
            {uploading ? (
              <>
                <span className="material-icons text-3xl text-primary animate-spin">
                  progress_activity
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  Subiendo...
                </span>
              </>
            ) : (
              <>
                <span className="material-icons text-3xl text-slate-400 dark:text-slate-500">
                  add_photo_alternate
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  Añadir imagen
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files)}
      />

      {/* Empty state */}
      {images.length === 0 && !uploading && (
        <p className="text-center text-sm text-slate-400 dark:text-slate-500 mt-2">
          Arrastra imágenes o haz clic para subir fotos del tipo de habitación
        </p>
      )}
    </div>
  );
}
