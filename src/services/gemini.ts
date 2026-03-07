import { GoogleGenAI, Type } from "@google/genai";
import { Expense, PersonalityType } from "../types";

const getAI = () => {
  const apiKey = localStorage.getItem('SENTIFI_GEMINI_KEY') || process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "" || apiKey === "MY_GEMINI_API_KEY") {
    throw new Error("MISSING_KEY");
  }
  return new GoogleGenAI({ apiKey });
};

export const analyzePersonality = async (expenses: Expense[]) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze: ${JSON.stringify(expenses)}`,
    config: {
      systemInstruction: "You are a financial psychologist. Classify the user into a spending personality. Return ONLY JSON.",
      responseMimeType: "application/json",
    }
  });
  return JSON.parse(response.text);
};

export const getMoodDoctorAdvice = async (expense: Expense, totalBudget: number, currentSpending: number) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Spent ${expense.amount} on ${expense.category} while ${expense.emotion}.`,
    config: {
      systemInstruction: "You are the Financial Mood Doctor. Provide empathetic advice.",
    }
  });
  return response.text;
};

export const getTriggerAnalysis = async (expenses: Expense[]) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze impulse buys: ${JSON.stringify(expenses)}`,
    config: {
      systemInstruction: "Identify spending triggers. Return text.",
    }
  });
  return response.text;
};

export const getSavingSuggestions = async (expenses: Expense[], monthlyBudget: number) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze: ${JSON.stringify(expenses)}. Budget: ${monthlyBudget}`,
    config: {
      systemInstruction: "Suggest savings. Return JSON.",
      responseMimeType: "application/json",
    }
  });
  return JSON.parse(response.text);
};export const getTriggerAnalysis = async (expenses: Expense[]) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze impulse buys: ${JSON.stringify(expenses)}`,
    config: {
      systemInstruction: "Identify spending triggers. Return text.",
    }
  });
  return response.text;
};

export const getSavingSuggestions = async (expenses: Expense[], monthlyBudget: number) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze: ${JSON.stringify(expenses)}. Budget: ${monthlyBudget}`,
    config: {
      systemInstruction: "Suggest savings. Return JSON.",
      responseMimeType: "application/json",
    }
  });
  return JSON.parse(response.text);
};
