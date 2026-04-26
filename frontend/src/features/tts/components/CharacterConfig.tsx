import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Settings2, Music, Upload, CheckCircle2, User, Mic, Trash2 } from 'lucide-react';
import { SpeakerConfig } from '../api/ttsClient';

interface CharacterConfigProps {
  speakers: string[];
  configs: Record<string, SpeakerConfig>;
  onChange: (configs: Record<string, SpeakerConfig>) => void;
  onUploadSample: (speaker: string, file: File) => Promise<void>;
  onDeleteSample?: (speaker: string) => Promise<void>;
}

const AVAILABLE_MODELS = [
  { id: 'jvnv-F1-jp', name: 'Nữ chuẩn (JVNV F1)' },
  { id: 'jvnv-F2-jp', name: 'Nữ trầm tĩnh (JVNV F2)' },
  { id: 'koharune-ami', name: 'Nữ dễ thương (Koharune Ami)' },
  { id: 'jvnv-M1-jp', name: 'Nam chuẩn (JVNV M1)' },
  { id: 'jvnv-M2-jp', name: 'Nam trầm/lớn tuổi (JVNV M2)' },
  { id: 'amitaro', name: 'Amitaro' },
];

const AVAILABLE_STYLES = ['Neutral', 'Happy', 'Sad', 'Angry', 'Surprise', 'Fear', 'Disgust'];

export const CharacterConfig: React.FC<CharacterConfigProps> = ({ speakers, configs, onChange, onUploadSample, onDeleteSample }) => {
  const updateConfig = (speaker: string, currentConfig: SpeakerConfig, field: keyof SpeakerConfig, value: any) => {
    onChange({
      ...configs,
      [speaker]: {
        ...currentConfig,
        [field]: value
      }
    });
  };

  if (speakers.length === 0) {
    return (
      <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-8 flex flex-col items-center justify-center text-center gap-3">
        <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
          <User className="w-6 h-6 text-slate-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Chưa tìm thấy nhân vật</p>
          <p className="text-xs text-slate-500 mt-1">Hãy gõ kịch bản theo cú pháp <b>Tên: Lời thoại</b> để hệ thống tự động nhận diện.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {speakers.map((speaker, index) => {
        const config = configs[speaker] || {
          model_name: speaker.includes('Nam') || speaker === '男' ? 'jvnv-M1-jp' : 'jvnv-F1-jp',
          style: 'Neutral',
          pitch_scale: 1.0,
          sdp_ratio: 0.2
        };

        const isMale = config.model_name === 'jvnv-M1-jp';
        const colorClass = isMale
          ? 'from-blue-500 to-sky-500 shadow-blue-500/20'
          : 'from-pink-500 to-rose-500 shadow-pink-500/20';

        const badgeClass = isMale
          ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800'
          : 'bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-900/30 dark:text-pink-300 dark:border-pink-800';

        return (
          <Card key={speaker} className="overflow-hidden border-2 shadow-sm transition-all hover:shadow-md">
            <CardHeader className="py-3 bg-slate-50/50 dark:bg-slate-900/20 border-b">
              <CardTitle className="text-sm font-bold flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${colorClass} shadow-md flex items-center justify-center text-white`}>
                    <Mic className="w-4 h-4" />
                  </div>
                  <span className="font-extrabold text-base">{speaker}</span>
                </div>
                {config.reference_audio_url && (
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 gap-1.5 px-2.5 py-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Đã có giọng mẫu
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Giọng đọc (Model)</Label>
                  <Select
                    value={config.model_name}
                    onValueChange={(v) => updateConfig(speaker, config, 'model_name', v)}
                  >
                    <SelectTrigger className="h-9 focus:ring-blue-500 border-slate-200 dark:border-slate-800">
                      <SelectValue placeholder="Chọn model" />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABLE_MODELS.map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Cảm xúc (Style)</Label>
                  <Select
                    value={config.style}
                    onValueChange={(v) => updateConfig(speaker, config, 'style', v)}
                  >
                    <SelectTrigger className="h-9 focus:ring-blue-500 border-slate-200 dark:border-slate-800">
                      <SelectValue placeholder="Chọn style" />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABLE_STYLES.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3 pt-1">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Tông giọng (Pitch)</Label>
                  <span className="text-xs font-mono font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                    {config.pitch_scale?.toFixed(1)}
                  </span>
                </div>
                <Slider
                  min={0.5}
                  max={1.5}
                  step={0.1}
                  value={[config.pitch_scale || 1.0]}
                  onValueChange={([v]) => updateConfig(speaker, config, 'pitch_scale', v)}
                  className="[&_[role=slider]]:border-blue-500 [&_[role=slider]]:focus:ring-blue-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-2">Clone ngữ điệu (Giọng mẫu)</Label>
                <div className="flex flex-col gap-3">
                  <div 
                    className="relative"
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const file = e.dataTransfer.files?.[0];
                      if (file && file.type.startsWith('audio/')) {
                        onUploadSample(speaker, file);
                      }
                    }}
                  >
                    <Input
                      type="file"
                      accept="audio/*"
                      className="hidden"
                      id={`file-${speaker}`}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) onUploadSample(speaker, file);
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2 border-dashed border-2 h-10 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all font-medium"
                      asChild
                    >
                      <label htmlFor={`file-${speaker}`} className="cursor-pointer">
                        <Upload className="w-4 h-4" />
                        Tải lên Audio mẫu
                      </label>
                    </Button>
                  </div>
                  
                  {config.reference_audio_url && (
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2 border border-slate-100 dark:border-slate-800 flex items-center gap-2">
                      <audio 
                        src={config.reference_audio_url} 
                        controls 
                        className="w-full h-8 outline-none"
                      />
                      {onDeleteSample && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 shrink-0"
                          onClick={() => onDeleteSample(speaker)}
                          title="Xoá giọng mẫu"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
