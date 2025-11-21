'use client';

import { useState, useRef } from 'react';
import { Render } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import Image from 'next/image';

interface RenderUploadProps {
  requestId: string;
  renders: Render[];
  onUploadComplete: () => void;
}

export function RenderUpload({
  requestId,
  renders,
  onUploadComplete,
}: RenderUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Veuillez sélectionner une image (JPG, PNG)');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('requestId', requestId);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      onUploadComplete();
    } catch (error) {
      console.error('Upload error:', error);
      alert('Erreur lors de l\'upload. Veuillez réessayer.');
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rendus</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 bg-gray-50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleChange}
            className="hidden"
            disabled={uploading}
          />
          <ImageIcon className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <p className="text-sm text-gray-600 mb-2">
            Glissez une image ici ou cliquez pour sélectionner
          </p>
          <p className="text-xs text-gray-500 mb-4">
            Formats acceptés: JPG, PNG
          </p>
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            variant="outline"
          >
            <Upload className="w-4 h-4 mr-2" />
            {uploading ? 'Upload en cours...' : 'Sélectionner un fichier'}
          </Button>
        </div>

        {renders.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6">
            {renders.map((render) => (
              <div
                key={render.id}
                className="relative group border rounded-lg overflow-hidden"
              >
                <div className="aspect-square relative bg-gray-100">
                  <Image
                    src={render.url}
                    alt={render.filename}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="p-2 bg-white">
                  <p className="text-xs text-gray-600 truncate">
                    {render.filename}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(render.uploadedAt).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

