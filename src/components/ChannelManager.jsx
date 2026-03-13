/**
 * ChannelManager - 通道管理组件
 * 合并自动回复和微信监控功能
 */
import React, { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card'
import { MessageSquare, Smartphone, Activity, RefreshCw, Settings, Hash } from 'lucide-react'
import AutoReply from './AutoReply'
import WechatMonitor from './WechatMonitor'
import TelegramChannelConfig from './TelegramChannelConfig'
import DiscordChannelConfig from './DiscordChannelConfig'
import SlackChannelConfig from './SlackChannelConfig'
import FeishuChannelConfig from './FeishuChannelConfig'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

// 通道状态概览卡片
function ChannelOverview({ autoReplyStatus, wechatStatus, onRefresh }) {
  return (
    <div className="grid grid-cols-2 gap-4 mb-4">
      <Card className="shadow-sm">
        <CardHeader className="pb-2 pt-3 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              自动回复
            </CardTitle>
            <div className="flex items-center gap-2">
              {autoReplyStatus?.enabled ? (
                <span className="flex items-center gap-1 text-xs text-green-600">
                  <Activity className="w-3 h-3" />
                  运行中
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">未启用</span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 pb-3 px-4">
          <CardDescription className="text-xs">
            {autoReplyStatus?.rules?.length || 0} 条规则已配置
          </CardDescription>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="pb-2 pt-3 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-primary" />
              微信监控
            </CardTitle>
            <div className="flex items-center gap-2">
              {wechatStatus?.running ? (
                <span className="flex items-center gap-1 text-xs text-green-600">
                  <Activity className="w-3 h-3" />
                  运行中
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">未运行</span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 pb-3 px-4">
          <CardDescription className="text-xs">
            {wechatStatus?.messageCount || 0} 条消息已处理
          </CardDescription>
        </CardContent>
      </Card>
    </div>
  )
}

export default function ChannelManager() {
  const [activeTab, setActiveTab] = useState('autoReply')
  const [autoReplyStatus, setAutoReplyStatus] = useState(null)
  const [wechatStatus, setWechatStatus] = useState(null)

  const cleanupInvalidChannelAgents = async () => {
    try {
      const result = await api.config.cleanupInvalidChannelAgentBindings()
      if (!result.success) {
        toast.error('通道清理失败', result.error || '保存配置失败')
        return
      }

      const removedTotal = Number(result?.data?.removed || 0)
      if (removedTotal > 0) {
        toast.success('通道配置已清理', `已移除 ${removedTotal} 个无效智能体绑定`)
      }
    } catch (error) {
      console.error('清理无效通道智能体失败:', error)
    }
  }

  // 加载状态
  const loadStatus = async () => {
    // 自动回复状态会由 AutoReply 组件内部管理
    // 微信监控状态会由 WechatMonitor 组件内部管理
  }

  useEffect(() => {
    cleanupInvalidChannelAgents().finally(() => {
      loadStatus()
    })
  }, [])

  return (
    <div className="space-y-4">
      {/* 通道状态概览 */}
      <ChannelOverview
        autoReplyStatus={autoReplyStatus}
        wechatStatus={wechatStatus}
        onRefresh={loadStatus}
      />

      {/* Tab 切换 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-fit flex-wrap">
          <TabsTrigger value="autoReply" className="flex items-center gap-1.5">
            <MessageSquare className="w-4 h-4" />
            自动回复
          </TabsTrigger>
          <TabsTrigger value="wechat" className="flex items-center gap-1.5">
            <Smartphone className="w-4 h-4" />
            微信监控
          </TabsTrigger>
          <TabsTrigger value="telegram" className="flex items-center gap-1.5">
            <Hash className="w-4 h-4" />
            Telegram
          </TabsTrigger>
          <TabsTrigger value="discord" className="flex items-center gap-1.5">
            <Hash className="w-4 h-4" />
            Discord
          </TabsTrigger>
          <TabsTrigger value="slack" className="flex items-center gap-1.5">
            <Hash className="w-4 h-4" />
            Slack
          </TabsTrigger>
          <TabsTrigger value="feishu" className="flex items-center gap-1.5">
            <Hash className="w-4 h-4" />
            飞书
          </TabsTrigger>
        </TabsList>

        <TabsContent value="autoReply" className="mt-4">
          <AutoReply onStatusChange={setAutoReplyStatus} />
        </TabsContent>

        <TabsContent value="wechat" className="mt-4">
          <WechatMonitor onStatusChange={setWechatStatus} />
        </TabsContent>

        <TabsContent value="telegram" className="mt-4">
          <TelegramChannelConfig />
        </TabsContent>

        <TabsContent value="discord" className="mt-4">
          <DiscordChannelConfig />
        </TabsContent>

        <TabsContent value="slack" className="mt-4">
          <SlackChannelConfig />
        </TabsContent>

        <TabsContent value="feishu" className="mt-4">
          <FeishuChannelConfig />
        </TabsContent>
      </Tabs>
    </div>
  )
}
