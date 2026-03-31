from app.services.analytics import AnalyticsService
from app.services.integrations import IntegrationService
from app.services.knowledge_base import KnowledgeBaseService
from app.services.luron import LuronService
from app.services.prompts import PromptAssemblyService
from app.services.settings import SettingsService

analytics_service = AnalyticsService()
knowledge_base_service = KnowledgeBaseService()
prompt_service = PromptAssemblyService()
integration_service = IntegrationService()
luron_service = LuronService()
settings_service = SettingsService()
