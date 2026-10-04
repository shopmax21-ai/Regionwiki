"use client";

import { useState } from "react";

import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, GraduationCap, RotateCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const quizzes = [
  {
    id: "project-overview",
    title: "Основы RegionWiki",
    description: "Проверьте понимание целей, структуры и возможностей проекта.",
    category: "О проекте",
    questions: 3,
    duration: "5 мин",
    difficulty: "Легкий",
    color: "bg-chart-1",
    items: [
      {
        question: "Какова основная цель RegionWiki?",
        answers: [
          "Создание игр",
          "Сбор и развитие базы знаний о регионах",
          "Продажа товаров",
          "Обучение программированию",
        ],
        correct: 1,
      },
      {
        question: "Что можно найти в RegionWiki?",
        answers: [
          "Только новости",
          "Информацию о регионах и их особенностях",
          "Только фотографии",
          "Музыкальные альбомы",
        ],
        correct: 1,
      },
      {
        question: "Кто может пользоваться материалами проекта?",
        answers: [
          "Только администраторы",
          "Только авторы статей",
          "Все пользователи проекта",
          "Только приглашённые гости",
        ],
        correct: 2,
      },
    ],
  },
  {
    id: "content-quality",
    title: "Качество материалов",
    description: "Тест по правилам подготовки, проверки и оформления материалов проекта.",
    category: "Контент проекта",
    questions: 3,
    duration: "5 мин",
    difficulty: "Средний",
    color: "bg-chart-2",
    items: [
      {
        question: "Что важно проверить перед публикацией материала?",
        answers: [
          "Только длину текста",
          "Факты, источники и понятность изложения",
          "Только цвет заголовка",
          "Количество изображений",
        ],
        correct: 1,
      },
      {
        question: "Каким должен быть хороший материал о регионе?",
        answers: [
          "Точным, структурированным и полезным",
          "Максимально коротким",
          "Без заголовков",
          "Скопированным из одного источника",
        ],
        correct: 0,
      },
      {
        question: "Зачем указывать источники информации?",
        answers: [
          "Для увеличения размера страницы",
          "Чтобы подтвердить достоверность материала",
          "Чтобы скрыть автора",
          "Это необязательно",
        ],
        correct: 1,
      },
    ],
  },
  {
    id: "workspace",
    title: "Работа с платформой",
    description: "Проверьте знание основных разделов и рабочих процессов RegionWiki.",
    category: "Рабочий процесс",
    questions: 3,
    duration: "5 мин",
    difficulty: "Средний",
    color: "bg-chart-3",
    items: [
      {
        question: "С чего начинается работа над новой публикацией?",
        answers: [
          "С проверки готового текста",
          "С выбора темы и сбора информации",
          "С удаления раздела",
          "С отправки пустой формы",
        ],
        correct: 1,
      },
      {
        question: "Что помогает быстро найти нужный материал?",
        answers: [
          "Поиск и навигация по разделам",
          "Только главная страница",
          "Перезагрузка браузера",
          "Изменение темы оформления",
        ],
        correct: 0,
      },
      {
        question: "Как лучше улучшать знания о проекте?",
        answers: [
          "Регулярно изучать материалы и проходить тесты",
          "Не читать инструкции",
          "Пропускать проверку",
          "Использовать случайные данные",
        ],
        correct: 0,
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
