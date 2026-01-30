import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  AudioWaveform,
  Scissors,
  Brain,
  FileText,
  CheckCircle2,
  Languages,
  Sparkles,
  ArrowRight,
  Play,
  Users,
  Zap,
  Shield,
  Clock,
} from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Separator } from '../components/ui/Separator'
import { Card } from '../components/ui/Card'

type FeatureItem = {
  id: string
  icon: React.ReactNode
  titleKey: string
  descriptionKey: string
}

export default function Home() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const features: FeatureItem[] = [
    {
      id: '1',
      icon: <AudioWaveform className="w-6 h-6" />,
      titleKey: 'features.uploadAudio.title',
      descriptionKey: 'features.uploadAudio.description',
    },
    {
      id: '2',
      icon: <Scissors className="w-6 h-6" />,
      titleKey: 'features.autoSplit.title',
      descriptionKey: 'features.autoSplit.description',
    },
    {
      id: '3',
      icon: <FileText className="w-6 h-6" />,
      titleKey: 'features.transcription.title',
      descriptionKey: 'features.transcription.description',
    },
    {
      id: '4',
      icon: <Brain className="w-6 h-6" />,
      titleKey: 'features.aiAnalysis.title',
      descriptionKey: 'features.aiAnalysis.description',
    },
    {
      id: '5',
      icon: <CheckCircle2 className="w-6 h-6" />,
      titleKey: 'features.teacherTools.title',
      descriptionKey: 'features.teacherTools.description',
    },
    {
      id: '6',
      icon: <Languages className="w-6 h-6" />,
      titleKey: 'features.questionBank.title',
      descriptionKey: 'features.questionBank.description',
    },
  ]

  const stats = [
    { labelKey: 'stats.audioHours', value: '10,000+' },
    { labelKey: 'stats.questions', value: '50,000+' },
    { labelKey: 'stats.teachers', value: '500+' },
    { labelKey: 'stats.successRate', value: '95%' },
  ]

  return (
    <div className="space-y-24 py-8">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/10 via-accent/5 to-transparent" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_30%_20%,rgba(120,119,198,0.3),transparent_50%)]" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_70%_60%,rgba(45,164,78,0.2),transparent_50%)]" />
        
        <div className="max-w-5xl mx-auto text-center space-y-8 py-20 px-4">
          <Badge variant="success" className="px-4 py-2 text-sm">
            <Sparkles className="w-4 h-4 mr-2" />
            {t('hero.badge')}
          </Badge>

          <h1 className="text-5xl md:text-7xl font-extrabold leading-tight tracking-tight">
            {t('hero.title')}
            <span className="block bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mt-3">
              {t('hero.titleHighlight')}
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed max-w-3xl mx-auto">
            {t('hero.description')}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-6">
            <Button
              onClick={() => navigate('/register')}
              size="lg"
              className="group min-w-[200px] h-12 text-base shadow-lg hover:shadow-xl transition-all"
            >
              {t('hero.getStarted')}
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button
              onClick={() => navigate('/dashboard')}
              variant="outline"
              size="lg"
              className="min-w-[200px] h-12 text-base"
            >
              <Play className="w-5 h-5 mr-2" />
              {t('hero.watchDemo')}
            </Button>
          </div>

          <div className="flex flex-wrap justify-center gap-8 pt-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-accent" />
              <span>{t('hero.fastProcessing')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-accent" />
              <span>{t('hero.secure')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-accent" />
              <span>{t('hero.available')}</span>
            </div>
          </div>
        </div>
      </section>

      <Separator className="my-16" />

      {/* Stats Section */}
      <section className="max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <Card
              key={index}
              className="text-center p-8 border-2 hover:border-primary/50 hover:shadow-xl transition-all duration-300 hover:scale-105"
            >
              <div className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-3">
                {stat.value}
              </div>
              <div className="text-sm font-medium text-muted-foreground">{t(stat.labelKey)}</div>
            </Card>
          ))}
        </div>
      </section>

      <Separator className="my-16" />

      {/* How It Works */}
      <section className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-16">
          <Badge variant="outline" className="mb-4 px-3 py-1">
            {t('howItWorks.badge')}
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">{t('howItWorks.title')}</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('howItWorks.description')}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 relative">
          {/* Step 1 */}
          <div className="relative">
            <Card className="flex flex-col items-center text-center space-y-6 p-8 border-2 hover:border-primary hover:shadow-2xl transition-all duration-300 group">
              <div className="relative">
                <div className="flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-lg group-hover:scale-110 transition-transform">
                  <span className="text-3xl font-bold">1</span>
                </div>
                <div className="absolute -bottom-2 -right-2 w-12 h-12 rounded-xl bg-accent/20 text-accent flex items-center justify-center group-hover:rotate-12 transition-transform">
                  <AudioWaveform className="w-6 h-6" />
                </div>
              </div>
              <h3 className="text-xl font-bold">{t('howItWorks.step1.title')}</h3>
              <p className="text-muted-foreground leading-relaxed">
                {t('howItWorks.step1.description')}
              </p>
            </Card>
            <div className="hidden md:block absolute top-10 -right-4 w-8 h-1 bg-gradient-to-r from-border to-transparent" />
          </div>

          {/* Step 2 */}
          <div className="relative">
            <Card className="flex flex-col items-center text-center space-y-6 p-8 border-2 hover:border-accent hover:shadow-2xl transition-all duration-300 group">
              <div className="relative">
                <div className="flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-accent to-accent/60 text-accent-foreground shadow-lg group-hover:scale-110 transition-transform">
                  <span className="text-3xl font-bold">2</span>
                </div>
                <div className="absolute -bottom-2 -right-2 w-12 h-12 rounded-xl bg-primary/20 text-primary flex items-center justify-center group-hover:rotate-12 transition-transform">
                  <Brain className="w-6 h-6" />
                </div>
              </div>
              <h3 className="text-xl font-bold">{t('howItWorks.step2.title')}</h3>
              <p className="text-muted-foreground leading-relaxed">
                {t('howItWorks.step2.description')}
              </p>
            </Card>
            <div className="hidden md:block absolute top-10 -right-4 w-8 h-1 bg-gradient-to-r from-border to-transparent" />
          </div>

          {/* Step 3 */}
          <Card className="flex flex-col items-center text-center space-y-6 p-8 border-2 hover:border-accent hover:shadow-2xl transition-all duration-300 group">
            <div className="relative">
              <div className="flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg group-hover:scale-110 transition-transform">
                <span className="text-3xl font-bold">3</span>
              </div>
              <div className="absolute -bottom-2 -right-2 w-12 h-12 rounded-xl bg-accent/20 text-accent flex items-center justify-center group-hover:rotate-12 transition-transform">
                <Users className="w-6 h-6" />
              </div>
            </div>
            <h3 className="text-xl font-bold">{t('howItWorks.step3.title')}</h3>
            <p className="text-muted-foreground leading-relaxed">
              {t('howItWorks.step3.description')}
            </p>
          </Card>
        </div>
      </section>

      <Separator className="my-16" />

      {/* Features Grid */}
      <section className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-16">
          <Badge variant="outline" className="mb-4 px-3 py-1">
            {t('features.badge')}
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">{t('features.title')}</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('features.description')}
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <Card
              key={feature.id}
              className="group p-6 border-2 hover:border-primary/50 hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
            >
              <div className="flex items-start space-x-4">
                <div className="shrink-0 p-3 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 text-primary group-hover:from-primary group-hover:to-accent group-hover:text-primary-foreground transition-all duration-300 group-hover:scale-110">
                  {feature.icon}
                </div>
                <div className="flex-1 space-y-2">
                  <h3 className="text-lg font-bold group-hover:text-primary transition-colors">
                    {t(feature.titleKey)}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {t(feature.descriptionKey)}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <Separator className="my-16" />

      {/* CTA Section */}
      <section className="max-w-5xl mx-auto px-4">
        <Card className="relative overflow-hidden border-2 border-primary/20">
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/80 to-accent opacity-90" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.1),transparent_70%)]" />
          
          <div className="relative p-12 md:p-16 text-center space-y-8">
            <div className="space-y-4">
              <Badge className="bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30">
                <Sparkles className="w-3 h-3 mr-1" />
                {t('cta.badge')}
              </Badge>
              <h2 className="text-4xl md:text-5xl font-extrabold text-primary-foreground">
                {t('cta.title')}
              </h2>
              <p className="text-xl text-primary-foreground/90 max-w-2xl mx-auto leading-relaxed">
                {t('cta.description')}
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-6">
              <Button
                onClick={() => navigate('/register')}
                size="lg"
                variant="secondary"
                className="min-w-[220px] h-14 text-base font-semibold shadow-xl hover:shadow-2xl group"
              >
                {t('cta.startTrial')}
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button
                onClick={() => navigate('/login')}
                size="lg"
                className="min-w-[220px] h-14 text-base font-semibold bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground border-2 border-primary-foreground/30"
              >
                {t('cta.signIn')}
              </Button>
            </div>

            <div className="flex flex-wrap justify-center gap-6 pt-6 text-sm text-primary-foreground/80">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>{t('cta.noCredit')}</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>{t('cta.freeTrial')}</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>{t('cta.cancelAnytime')}</span>
              </div>
            </div>
          </div>
        </Card>
      </section>
    </div>
  )
}
