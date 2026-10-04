"use client";

import { useState } from "react";

import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, GraduationCap, RotateCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const quizzes = [
  {
    id: "math",
    title: "Алгебра и функции",
    description: "Проверьте знания линейных и квадратных функций.",
    category: "Математика",
    questions: 10,
    duration: "15 мин",
    difficulty: "Средний",
    color: "bg-chart-1",
    items: [
      {
        question: "Какой график имеет линейная функция?",
        answers: ["Парабола", "Прямая", "Гипербола", "Окружность"],
        correct: 1,
      },
      { question: "Чему равен корень уравнения 2x = 10?", answers: ["2", "4", "5", "10"], correct: 2 },
      {
        question: "Что показывает коэффициент наклона прямой?",
        answers: ["Смещение по оси Y", "Угол наклона", "Радиус", "Площадь"],
        correct: 1,
      },
    ],
  },
  {
    id: "history",
    title: "История России",
    description: "Ключевые даты, события и личности отечественной истории.",
    category: "История",
    questions: 12,
    duration: "20 мин",
    difficulty: "Сложный",
    color: "bg-chart-2",
    items: [
      { question: "В каком году произошло Крещение Руси?", answers: ["862", "988", "1147", "1380"], correct: 1 },
      {
        question: "Кто был первым русским царём?",
        answers: ["Пётр I", "Иван IV", "Александр I", "Николай II"],
        correct: 1,
      },
      { question: "В каком веке состоялась Куликовская битва?", answers: ["XII", "XIII", "XIV", "XV"], correct: 2 },
    ],
  },
  {
    id: "english",
    title: "English Grammar",
    description: "Времена, условные предложения и устойчивые выражения.",
    category: "Английский язык",
    questions: 15,
    duration: "18 мин",
    difficulty: "Средний",
    color: "bg-chart-3",
    items: [
      {
        question: "Choose the correct form: She ___ to school every day.",
        answers: ["go", "goes", "going", "gone"],
        correct: 1,
      },
      {
        question: "Which tense describes an action happening now?",
        answers: ["Present Simple", "Past Simple", "Present Continuous", "Future Simple"],
        correct: 2,
      },
      {
        question: "Complete: If I had time, I ___ more.",
        answers: ["travel", "will travel", "would travel", "travelled"],
        correct: 2,
      },
    ],
  },
  {
    id: "science",
    title: "Естествознание",
    description: "Физика, химия и биология в одном комплексном тесте.",
    category: "Наука",
    questions: 8,
    duration: "12 мин",
    difficulty: "Легкий",
    color: "bg-chart-4",
    items: [
      { question: "Какая планета ближе всего к Солнцу?", answers: ["Венера", "Земля", "Меркурий", "Марс"], correct: 2 },
      {
        question: "Какой газ необходим человеку для дыхания?",
        answers: ["Азот", "Кислород", "Углекислый газ", "Водород"],
        correct: 1,
      },
      {
        question: "Как называется переход воды из жидкого состояния в газообразное?",
        answers: ["Конденсация", "Плавление", "Испарение", "Замерзание"],
        correct: 2,
      },
    ],
  },
];

type Quiz = (typeof quizzes)[number];

export function QuizCenter() {
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [finished, setFinished] = useState(false);

  const startQuiz = (quiz: Quiz) => {
    setSelectedQuiz(quiz);
    setQuestionIndex(0);
    setAnswers([]);
    setFinished(false);
  };

  if (selectedQuiz) {
    const question = selectedQuiz.items[questionIndex];
    const score = answers.reduce(
      (total, answer, index) => total + (answer === selectedQuiz.items[index]?.correct ? 1 : 0),
      0,
    );

    if (finished) {
      return (
        <Card>
          <CardContent className="flex flex-col items-center gap-5 py-12 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CheckCircle2 />
            </div>
            <div className="flex flex-col gap-1">
              <h2 className="font-semibold text-xl">Тест завершён</h2>
              <p className="text-muted-foreground text-sm">
                Ваш результат: {score} из {selectedQuiz.items.length} правильных ответов
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => startQuiz(selectedQuiz)}>
                <RotateCcw data-icon="inline-start" />
                Пройти ещё раз
              </Button>
              <Button variant="outline" onClick={() => setSelectedQuiz(null)}>
                Выбрать другой тест
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    const selectedAnswer = answers[questionIndex];
    const isLast = questionIndex === selectedQuiz.items.length - 1;
    return (
      <Card>
        <CardHeader className="gap-4">
          <div className="flex items-center justify-between gap-3">
            <Button variant="ghost" size="sm" onClick={() => setSelectedQuiz(null)}>
              <ArrowLeft data-icon="inline-start" />
              Все тесты
            </Button>
            <Badge variant="secondary">
              {questionIndex + 1} / {selectedQuiz.items.length}
            </Badge>
          </div>
          <Progress value={((questionIndex + 1) / selectedQuiz.items.length) * 100} />
          <CardTitle className="pt-3">{question.question}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid gap-2">
            {question.answers.map((answer, index) => (
              <button
                type="button"
                key={answer}
                onClick={() => setAnswers((current) => [...current.slice(0, questionIndex), index])}
                className={`rounded-lg border p-4 text-left text-sm transition-colors hover:bg-muted ${selectedAnswer === index ? "border-primary bg-primary/10" : "border-border"}`}
                aria-pressed={selectedAnswer === index}
              >
                {String.fromCharCode(65 + index)}. {answer}
              </button>
            ))}
          </div>
          <div className="flex justify-end pt-3">
            <Button
              disabled={selectedAnswer === undefined}
              onClick={() => (isLast ? setFinished(true) : setQuestionIndex((current) => current + 1))}
            >
              {isLast ? "Завершить тест" : "Следующий вопрос"}
              <ArrowRight data-icon="inline-end" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Пройдено тестов</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl tracking-tight">12</span>
            <p className="text-muted-foreground text-xs">за этот месяц</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Средний результат</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl tracking-tight">86%</span>
            <p className="text-muted-foreground text-xs">на 8% выше прошлого месяца</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Серия обучения</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl tracking-tight">7 дней</span>
            <p className="text-muted-foreground text-xs">продолжайте в том же духе</p>
          </CardContent>
        </Card>
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="font-semibold text-xl">Выберите тест</h2>
        <p className="text-muted-foreground text-sm">Проверьте знания и отслеживайте свой прогресс.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {quizzes.map((quiz) => (
          <Card key={quiz.id} className="flex flex-col">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className={`flex size-10 items-center justify-center rounded-lg ${quiz.color} text-background`}>
                  <GraduationCap />
                </div>
                <Badge variant="outline">{quiz.difficulty}</Badge>
              </div>
              <CardTitle className="pt-2">{quiz.title}</CardTitle>
              <CardDescription>{quiz.description}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto flex flex-col gap-4">
              <div className="flex items-center gap-4 text-muted-foreground text-xs">
                <span className="flex items-center gap-1">
                  <Clock3 />
                  {quiz.duration}
                </span>
                <span>{quiz.questions} вопросов</span>
                <span>{quiz.category}</span>
              </div>
              <Button onClick={() => startQuiz(quiz)}>
                Начать тест
                <ArrowRight data-icon="inline-end" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export type { Quiz };
