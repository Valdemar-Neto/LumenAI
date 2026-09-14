import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

interface NewProjectDialogProps {
  open: boolean;
  githubOwner: string | null;
  onOpenChange: (open: boolean) => void;
  onCreate: (projectName: string) => Promise<void>;
}

function slugPreview(name: string) {
  return (
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 90) || '…'
  );
}

export function NewProjectDialog({ open, githubOwner, onOpenChange, onCreate }: NewProjectDialogProps) {
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setError(null);
      setCreating(false);
    }
  }, [open]);

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed || creating) return;

    setCreating(true);
    setError(null);
    try {
      await onCreate(trimmed);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  }

  const slug = slugPreview(name);

  return (
    <Dialog open={open} onOpenChange={(o) => !creating && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo projeto</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-gray-500 mb-3 leading-relaxed">
          Cada projeto vira um repositório novo no GitHub, com deploy automático via GitHub Pages.
        </p>

        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          placeholder="Ex: Cafeteria em Natal"
          autoFocus
          disabled={creating}
        />

        <p className="mt-2 text-xs text-gray-500 font-mono truncate">
          Repositório: {githubOwner || '…'}/{slug}
        </p>

        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

        <DialogFooter>
          <button
            onClick={() => onOpenChange(false)}
            disabled={creating}
            className="px-3 py-1.5 text-sm rounded-md text-gray-300 hover:bg-gray-800 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !name.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-lumen-500 text-gray-950 font-medium hover:brightness-110 disabled:opacity-50"
          >
            {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {creating ? 'Criando repositório…' : 'Criar projeto'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
